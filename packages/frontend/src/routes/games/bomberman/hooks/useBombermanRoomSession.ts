import type {
  BombermanConnectResponse,
  BombermanRoomState,
  BombermanPreGameClientAction,
  BombermanPreGameClientDispatch,
  BombermanPreGameServerEvent,
  BombermanState,
  BombermanOperation,
} from "@generale/types";
import { createMemo, createSignal, onMount, onCleanup } from "solid-js";
import { useSyncedState } from "~/hooks/useSyncedState";
import { applyBombermanRoomEventLocal } from "./bombermanRoomReducer";
import { applyBombermanEventLocal } from "./bombermanGameReducer";

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

export interface GameEndedInfo {
  rankings: { playerId: string; name: string; rank: number }[];
  winnerId: string | null;
}

export interface BombermanRoomSession {
  /** Current phase of the room lifecycle. */
  phase: () => "loading" | "lobby" | "playing" | "ended" | "error";
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

  /** Game-ended info (set when phase transitions to "ended" via server event). */
  gameEnded: () => GameEndedInfo | null;

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
}

/**
 * Room-level sync orchestrator for bomberman.
 *
 * Manages:
 *  - Phase state machine (loading → lobby/playing → ended/error)
 *  - Connection to the room (pregame) domain
 *  - Connection to the game domain (started when phase transitions to playing)
 *  - Lifecycle cleanup
 *
 * Follows the pattern established by generale/useRoomSession.ts.
 */
export function useBombermanRoomSession(params: { id: string; password?: string }): BombermanRoomSession {
  const [playerId, setPlayerId] = createSignal("");
  const [phase, setPhase] = createSignal<"loading" | "lobby" | "playing" | "ended" | "error">("loading");
  const [error, setError] = createSignal("");
  const [gameEnded, setGameEnded] = createSignal<GameEndedInfo | null>(null);
  const [chatDomain, setChatDomain] = createSignal<string | null>(null);
  const [displaced, setDisplaced] = createSignal(false);
  const [selfStatus, setSelfStatus] = createSignal<"lobby" | "playing" | "spectating">("lobby");

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

  const roomSync = useSyncedState<BombermanRoomState, BombermanPreGameClientAction, BombermanPreGameServerEvent>({
    domain: roomDomain,
    initialState: {
      roomName: "",
      players: [],
      config: {} as BombermanRoomState["config"],
      phase: "lobby",
      maxPlayers: 4,
      hostId: "",
    },
    applyEvent: (state, action) =>
      applyBombermanRoomEventLocal(state, action as unknown as BombermanPreGameClientDispatch, playerId()),
    openPayload: effectivePassword ? { password: effectivePassword } : {},
    onCustomEvent: (evt: BombermanPreGameServerEvent) => {
      switch (evt.type) {
        case "gamestarted":
          setPhase("playing");
          setSelfStatus("playing");
          setTimeout(() => gameSync.connect(), 500);
          break;
        case "gameended":
          setGameEnded({ rankings: evt.rankings, winnerId: evt.winnerId });
          setPhase("ended");
          gameSync.disconnect();
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
    domain: gameDomain,
    initialState: null as unknown as BombermanState,
    applyEvent: (state, op) => applyBombermanEventLocal(state, op, playerId()),
    onCustomEvent: (evt) => {
      if (evt.type === "displaced") {
        setDisplaced(true);
      }
    },
    autoOpen: false,
  });

  onMount(async () => {
    try {
      const res = await fetch(`/api/bomberman/room/connect/${params.id}`);
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
      const dChat = d.data.domains?.chat ?? null;
      if (dChat && chatDomain() !== dChat) setChatDomain(dChat);
      if (needsPassword()) {
        // Room has a password and we don't have one yet — show password card
        setPhase("lobby");
      } else if (d.data.phase === "playing") {
        setPhase("playing");
        setSelfStatus("playing");
        gameSync.connect();
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

  return {
    phase,
    error,
    playerId,
    chatDomain,
    roomSync: roomSync as unknown as SyncedState<BombermanRoomState, BombermanPreGameClientDispatch>,
    gameSync: gameSync as unknown as SyncedState<BombermanState, BombermanOperation>,
    gameEnded,
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
  };
}
