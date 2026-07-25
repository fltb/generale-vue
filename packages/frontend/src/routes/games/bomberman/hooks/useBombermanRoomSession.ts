import type {
  BombermanConnectResponse,
  BombermanRoomState,
  BombermanPreGameClientAction,
  BombermanPreGameClientDispatch,
  BombermanPreGameServerEvent,
  BombermanState,
  BombermanOperation,
  BombermanMatchRanking,
} from "@generale/types";
import { createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { useSyncedState } from "~/hooks/useSyncedState";
import { applyBombermanRoomEventLocal } from "./bombermanRoomReducer";
import { applyBombermanEventLocal } from "./bombermanGameReducer";
import bridge from "~/testBridge";

/**
 * Public shape of a synced-state handle, mirroring what useSyncedState returns.
 * TState = the full state type; TAction = the dispatch action type (without optimisticId).
 */
export interface SyncedState<TState, TAction> {
  state: () => TState;
  dispatch: (action: TAction) => number;
  connect: () => Promise<void>;
  disconnect: () => void;
  isReady: () => boolean;
}

export interface BombermanRoomSession {
  /** Current phase of the room lifecycle. */
  phase: () => "loading" | "lobby" | "playing" | "between_rounds" | "ended" | "error";
  /** Error message if phase is "error". */
  error: () => string;
  /** The local player's id (empty string until connected). */
  playerId: () => string;
  /** Chat sub-domain for the room/game, null until connected. */
  chatDomain: () => string | null;

  /** Room (pregame) sync handle — used for lobby settings, ready/unready, etc. */
  roomSync: SyncedState<BombermanRoomState, BombermanPreGameClientDispatch>;
  /** Game sync handle — used during active play. */
  gameSync: SyncedState<BombermanState, BombermanOperation>;

  /** Server-driven match rankings (set when phase transitions to "ended" via MATCH_ENDED event). */
  matchRankings: () => BombermanMatchRanking[] | null;

  /** Current player status within the room (lobby / playing / spectating). */
  selfStatus: () => "lobby" | "playing" | "spectating";

  /** Dispatch START_GAME to the room domain (host only; no permission check). */
  startGame: () => void;
  /** Enter spectate mode — sends ENTER_SPECTATE action. */
  enterSpectate: () => void;
  /** Leave spectate mode — sends LEAVE_SPECTATE action. */
  leaveSpectate: () => void;

  /** Whether the room has a password (undefined until known). */
  hasPassword: () => boolean | undefined;
  /** The stored room password (null if not set yet). */
  roomPassword: () => string | null;
  /** True when room has a password and we haven't provided one yet. */
  needsPassword: () => boolean;
  /** True after a wrong-password attempt (survives reload via sessionStorage). */
  wrongPassword: () => boolean;
  /** Store a password (persists to sessionStorage) and clear wrong-password flag. */
  setPassword: (pw: string | null) => void;

  /** True when another client (same user) took over this session. */
  displaced: () => boolean;

  /** True while the game UI should be shown (playing/spectating, plus a brief window after game ended). */
  showingGameUI: () => boolean;
  /** True immediately after game ended — used to keep game mounted for result screen. */
  gameJustEnded: () => boolean;
  /** True when the current session started a fresh game (not a reconnect). */
  startedThisSession: () => boolean;

  /** Dismiss the game-ended overlay and return to lobby */
  handleDismissGameEnd: () => void;
}

/**
 * Room-level sync orchestrator for bomberman.
 *
 * Manages:
 *  - Phase state machine (loading → lobby/playing → ended/error)
 *  - Connection to the room (pregame) domain
/**
 * Room-level sync orchestrator for bomberman.
 *
 * Creates two useSyncedState instances — one for the room (pregame) domain
 * and one for the game (in-play) domain. Handles the phase transitions,
 * password flow, game-start signaling, disconnect deadlines, spectate modes,
 * and both client-driven and server-driven state transitions.
 *
 * Supports role-aware entry: pass `role: "spectator"` to connect as a
 * spectator rather than a player. The backend verifies this and returns
 * the resolved role in BombermanConnectResponse.role.
 */
export function useBombermanRoomSession(params: {
  id: string;
  password?: string;
  role?: "player" | "spectator";
}): BombermanRoomSession {
  const [playerId, setPlayerId] = createSignal("");
  const [phase, setPhase] = createSignal<"loading" | "lobby" | "playing" | "between_rounds" | "ended" | "error">(
    "loading",
  );
  const [error, setError] = createSignal("");
  const [matchRankings, setMatchRankings] = createSignal<BombermanMatchRanking[] | null>(null);
  const [chatDomain, setChatDomain] = createSignal<string | null>(null);
  const [displaced, setDisplaced] = createSignal(false);
  const [selfStatus, setSelfStatus] = createSignal<"lobby" | "playing" | "spectating">("lobby");
  const [gameJustEnded, setGameJustEnded] = createSignal(false);
  const [startedThisSession] = createSignal(false);

  const showingGameUI = createMemo(
    () =>
      (phase() === "playing" || phase() === "between_rounds") &&
      (selfStatus() === "playing" || selfStatus() === "spectating" || gameJustEnded()),
  );

  // ── Game sync resync watchdog ──
  const MAX_WATCHDOG_ATTEMPTS = 5;
  const WATCHDOG_INTERVAL_MS = 2000;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let watchdogAttempts = 0;

  function stopWatchdog() {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    watchdogAttempts = 0;
  }

  function startGameWatchdog() {
    stopWatchdog();
    watchdogAttempts = 0;
    watchdogTimer = setInterval(() => {
      if (watchdogAttempts >= MAX_WATCHDOG_ATTEMPTS) {
        stopWatchdog();
        return;
      }
      const s = gameSync.state();
      if (s?.map?.tiles?.length && s.map.tiles.length > 0 && s.map.tiles[0]?.length) {
        // Map data is populated — watchdog has done its job
        stopWatchdog();
        return;
      }
      // No map data yet — reconnect to trigger a fresh snapshot
      watchdogAttempts++;
      gameSync.disconnect();
      setTimeout(() => gameSync.connect(), 200);
    }, WATCHDOG_INTERVAL_MS);
  }

  // Password state machine
  const [hasPassword, setHasPassword] = createSignal<boolean | undefined>(undefined);
  const storedPw = sessionStorage.getItem("bomberman-room-invite-pw");
  const [roomPassword, setRoomPassword] = createSignal<string | null>(storedPw ?? null);
  const wrongPwFlag = sessionStorage.getItem("bomberman-room-wrong-pw");
  if (wrongPwFlag) sessionStorage.removeItem("bomberman-room-wrong-pw");
  const [wrongPassword, setWrongPassword] = createSignal(!!wrongPwFlag);

  const needsPassword = createMemo(() => hasPassword() === true && !roomPassword());
  /** Effective password: sessionStorage (from password card) takes priority over URL param. */
  const effectivePassword = roomPassword() ?? params.password;

  function setPassword(pw: string | null) {
    if (pw) sessionStorage.setItem("bomberman-room-invite-pw", pw);
    else sessionStorage.removeItem("bomberman-room-invite-pw");
    setRoomPassword(pw);
    setWrongPassword(false);
    // Reload so onMount re-runs with the stored password
    window.location.reload();
  }

  const roomDomain = `room-${params.id}`;
  const gameDomain = `game-${params.id}`;

  // Read domains from API (prefer API over hardcoded interpolation)
  const [resolvedRoomDomain, setResolvedRoomDomain] = createSignal(roomDomain);
  const [resolvedGameDomain, setResolvedGameDomain] = createSignal(gameDomain);

  const roomSync = useSyncedState<BombermanRoomState, BombermanPreGameClientAction, BombermanPreGameServerEvent>({
    domain: resolvedRoomDomain(),
    initialState: {
      roomName: "",
      players: [],
      config: {} as BombermanRoomState["config"],
      phase: "lobby",
      maxPlayers: 4,
      hostId: "",
      match: {
        format: "single",
        targetWins: 1,
        currentRound: 1,
        currentAttempt: 1,
        scores: [],
        roundResults: [],
        winner: null,
        nextRoundStartsAt: null,
      },
      teams: [],
      spectators: [],
    },
    applyEvent: (state, action) =>
      applyBombermanRoomEventLocal(state, action as unknown as BombermanPreGameClientDispatch, playerId()),
    openPayload: effectivePassword
      ? { password: effectivePassword, role: params.role ?? "player" }
      : { role: params.role ?? "player" },
    onCustomEvent: (evt: BombermanPreGameServerEvent) => {
      switch (evt.type) {
        case "roundstarted":
          applyLifecycleMatch("ROUND_STARTED", evt.match);
          setPhase("playing");
          setSelfStatus("playing");
          setTimeout(() => {
            gameSync.connect();
            startGameWatchdog();
          }, 500);
          break;
        case "roundended":
          applyLifecycleMatch("ROUND_ENDED", evt.match);
          setPhase("between_rounds");
          gameSync.disconnect();
          gameSync.reset(null as unknown as BombermanState);
          break;
        case "matchended":
          applyLifecycleMatch("MATCH_ENDED", evt.match);
          setPhase("ended");
          setMatchRankings(evt.rankings);
          setGameJustEnded(true);
          gameSync.disconnect();
          // Reset gameSync state to its initial null value. The next startGame()
          // will receive a fresh snapshot — without this reset, the old game's
          // final state (status: Ended, lingering bombs/explosions) and any
          // stale optimistic events would persist in the store.
          gameSync.reset(null as unknown as BombermanState);
          break;
        case "kicked":
          setError("You have been kicked from the room");
          setPhase("error");
          break;
        case "disbanded":
          setError("The room has been disbanded");
          setPhase("error");
          break;
        case "displaced":
          setDisplaced(true);
          break;
      }
    },
    onConnectionClosed: ({ code }) => {
      if (code === 4003) {
        sessionStorage.removeItem("bomberman-room-invite-pw");
        sessionStorage.setItem("bomberman-room-wrong-pw", "1");
        window.location.reload();
        return;
      }
      setError("bomberman.connectionLost");
      setPhase("error");
    },
    autoOpen: false,
  });

  const gameSync = useSyncedState<
    BombermanState,
    BombermanOperation & { optimisticId: number },
    BombermanPreGameServerEvent
  >({
    domain: resolvedGameDomain(),
    initialState: null as unknown as BombermanState,
    applyEvent: (state, op) => applyBombermanEventLocal(state, op, playerId()),
    onCustomEvent: (evt) => {
      if (evt.type === "displaced") {
        setDisplaced(true);
      }
    },
    autoOpen: false,
  });

  function applyLifecycleMatch(
    type: "ROUND_STARTED" | "ROUND_ENDED" | "MATCH_ENDED",
    match: BombermanRoomState["match"],
  ) {
    const nextRoomState = applyBombermanRoomEventLocal(roomSync.state(), { type, match });
    roomSync.reset(nextRoomState);
  }

  onMount(async () => {
    try {
      const roleQuery = params.role && params.role !== "player" ? `?role=${encodeURIComponent(params.role)}` : "";
      const res = await fetch(`/api/bomberman/room/connect/${params.id}${roleQuery}`);
      const d: {
        success: boolean;
        message?: string;
        data?: BombermanConnectResponse;
      } = await res.json();
      if (!(d.success && d.data)) {
        setError(d.message || "Failed to connect");
        setPhase("error");
        return;
      }
      setPlayerId(d.data.playerId);
      setHasPassword(!!d.data.hasPassword);
      // Use domains from API when available, fall back to interpolation
      const dRoom = d.data.domains?.primary ?? `room-${params.id}`;
      const dGame = d.data.domains?.game ?? `game-${params.id}`;
      if (dRoom && resolvedRoomDomain() !== dRoom) setResolvedRoomDomain(dRoom);
      if (dGame && resolvedGameDomain() !== dGame) setResolvedGameDomain(dGame);
      const dChat = d.data.domains?.chat ?? null;
      if (dChat) setChatDomain(dChat);
      // Use server-resolved role for phase transitions
      const serverRole = d.data.role ?? "player";
      if (serverRole === "spectator") {
        setSelfStatus("spectating");
      }
      if (needsPassword()) {
        // Room has a password and we don't have one yet — show password card
        setPhase("lobby");
      } else if (d.data.phase === "playing") {
        setPhase("playing");
        if (serverRole !== "spectator") setSelfStatus("playing");
        roomSync.connect();
        gameSync.connect();
        startGameWatchdog();
      } else if (d.data.phase === "between_rounds") {
        setPhase("between_rounds");
        if (serverRole !== "spectator") setSelfStatus("playing");
        // Spectators also get room sync during between-rounds
        roomSync.connect();
      } else {
        setPhase("lobby");
        roomSync.connect();
      }
    } catch {
      setError("Network error");
      setPhase("error");
    }
  });

  onCleanup(() => {
    stopWatchdog();
    roomSync.disconnect();
    gameSync.disconnect();
  });

  function startGame() {
    roomSync.dispatch({ type: "START_GAME" });
  }

  function enterSpectate() {
    roomSync.dispatch({ type: "ENTER_SPECTATE" });
    setSelfStatus("spectating");
  }

  function leaveSpectate() {
    roomSync.dispatch({ type: "LEAVE_SPECTATE" });
    setSelfStatus("lobby");
  }

  function handleDismissGameEnd() {
    setMatchRankings(null);
    setGameJustEnded(false);
    setPhase("lobby");
  }

  // ─── Bridge: expose state for E2E testing & console debugging ───
  bridge.roomId = params.id;
  bridge.onOperationQueued = (op) => gameSync.dispatch(op as never);

  return {
    phase,
    error,
    playerId,
    chatDomain,
    roomSync: roomSync as unknown as SyncedState<BombermanRoomState, BombermanPreGameClientDispatch>,
    gameSync: gameSync as unknown as SyncedState<BombermanState, BombermanOperation>,
    matchRankings,
    selfStatus,
    startGame,
    enterSpectate,
    leaveSpectate,
    hasPassword,
    roomPassword,
    needsPassword,
    wrongPassword,
    setPassword,
    displaced,
    showingGameUI,
    gameJustEnded,
    startedThisSession,
    handleDismissGameEnd,
  };
}
