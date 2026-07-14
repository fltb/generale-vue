import type {
  BombermanRoomState,
  BombermanPreGameClientAction,
  BombermanPreGameClientDispatch,
  BombermanPreGameServerEvent,
  BombermanState,
  BombermanOperation,
} from "@generale/types";
import { createSignal, onMount, onCleanup } from "solid-js";
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

  /** Room (pregame) sync handle — used for lobby settings, ready/unready, etc. */
  roomSync: SyncedState<BombermanRoomState, BombermanPreGameClientDispatch>;
  /** Game sync handle — used during active play. */
  gameSync: SyncedState<BombermanState, BombermanOperation>;

  /** Game-ended info (set when phase transitions to "ended" via server event). */
  gameEnded: () => GameEndedInfo | null;

  /** Dispatch START_GAME to the room domain (host only; no permission check). */
  startGame: () => void;
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
export function useBombermanRoomSession(params: {
  id: string;
  password?: string;
}): BombermanRoomSession {
  const [playerId, setPlayerId] = createSignal("");
  const [phase, setPhase] = createSignal<"loading" | "lobby" | "playing" | "ended" | "error">("loading");
  const [error, setError] = createSignal("");
  const [gameEnded, setGameEnded] = createSignal<GameEndedInfo | null>(null);

  const roomDomain = `room-${params.id}`;
  const gameDomain = `game-${params.id}`;

  const roomSync = useSyncedState<
    BombermanRoomState,
    BombermanPreGameClientAction,
    BombermanPreGameServerEvent
  >({
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
    openPayload: params.password ? { password: params.password } : {},
    onCustomEvent: (evt: BombermanPreGameServerEvent) => {
      switch (evt.type) {
        case "gamestarted":
          setPhase("playing");
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
      }
    },
    onConnectionClosed: () => {
      setError("bomberman.connectionLost");
      setPhase("error");
    },
    autoOpen: false,
  });

  const gameSync = useSyncedState<
    BombermanState,
    BombermanOperation & { optimisticId: number },
    never
  >({
    domain: gameDomain,
    initialState: null as unknown as BombermanState,
    applyEvent: (state, op) => applyBombermanEventLocal(state, op, playerId()),
    autoOpen: false,
  });

  onMount(async () => {
    try {
      const res = await fetch(`/api/bomberman/room/connect/${params.id}`);
      const d: {
        success: boolean;
        message?: string;
        data?: { playerId: string; phase: string };
      } = await res.json();
      if (!(d.success && d.data)) {
        setError(d.message || "Failed to connect");
        setPhase("error");
        return;
      }
      setPlayerId(d.data.playerId);
      if (d.data.phase === "playing") {
        setPhase("playing");
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

  return {
    phase,
    error,
    playerId,
    roomSync: roomSync as unknown as SyncedState<BombermanRoomState, BombermanPreGameClientDispatch>,
    gameSync: gameSync as unknown as SyncedState<BombermanState, BombermanOperation>,
    gameEnded,
    startGame,
  };
}
