import { BombermanPreGameServerEventType } from "@generale/types";
import type {
  BombermanRoomState,
  BombermanPreGameClientAction,
  BombermanPreGameServerEvent,
  BombermanState,
  BombermanOperation,
} from "@generale/types";
import { useParams, useNavigate } from "@solidjs/router";
import { createSignal, createMemo, onMount, onCleanup, Show } from "solid-js";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { useSyncedState } from "~/hooks/useSyncedState";
import { BombermanGame } from "./game";

export function BombermanRoom() {
  const params = useParams();
  const navigate = useNavigate();
  const [playerId, setPlayerId] = createSignal("");
  const [phase, setPhase] = createSignal<"loading" | "lobby" | "playing" | "ended" | "error">("loading");
  const [error, setError] = createSignal("");
  const [showSettings, setShowSettings] = createSignal(false);
  const [gameOver, setGameOver] = createSignal<{
    rankings: { playerId: string; rank: number }[];
    winnerId: string | null;
  } | null>(null);

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
    applyEvent: (s) => s,
    onCustomEvent: (evt) => {
      const e = evt as BombermanPreGameServerEvent;
      if (e.type === BombermanPreGameServerEventType.GAME_STARTED) {
        setPhase("playing");
        setTimeout(() => gameSync.connect(), 500);
      }
      if (e.type === BombermanPreGameServerEventType.GAME_ENDED) {
        setGameOver({ rankings: e.rankings, winnerId: e.winnerId });
        setPhase("ended");
      }
      if (e.type === BombermanPreGameServerEventType.KICKED) {
        setError("You were kicked from the room");
        setPhase("error");
      }
      if (e.type === BombermanPreGameServerEventType.ROOM_DISBANDED) {
        setError("Room has been disbanded");
        setPhase("error");
      }
    },
    onConnectionClosed: () => {
      setError("Connection lost");
      setPhase("error");
    },
    autoOpen: false,
  });

  const gameSync = useSyncedState<BombermanState, BombermanOperation & { optimisticId: number }, never>({
    domain: gameDomain,
    initialState: null as unknown as BombermanState,
    applyEvent: (s) => s,
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

  const selfPlayer = createMemo(() => (roomSync.state().players ?? []).find((p) => p.id === playerId()));
  const isHost = createMemo(() => selfPlayer()?.isHost ?? false);
  const allReady = createMemo(() => {
    const players = roomSync.state().players ?? [];
    return players.length >= 2 && players.every((p) => p.ready);
  });

  function toggleReady() {
    if (selfPlayer()?.ready) roomSync.dispatch({ type: "UNREADY" });
    else roomSync.dispatch({ type: "READY" });
  }
  function startGame() {
    if (isHost() && allReady()) roomSync.dispatch({ type: "START_GAME" });
  }
  function handleGameAction(op: BombermanOperation) {
    gameSync.dispatch(op);
  }

  onCleanup(() => {
    roomSync.disconnect();
    gameSync.disconnect();
  });

  return (
    <ProtectedRoute>
      <Show when={phase() === "loading"}>
        <div class="p-8 text-center">
          <span class="loading loading-spinner loading-lg" />
        </div>
      </Show>

      <Show when={phase() === "error"}>
        <div class="p-8 text-center">
          <div class="alert alert-error mb-4">{error()}</div>
          <button class="btn" onClick={() => navigate("/bomberman")}>
            Back to Lobby
          </button>
        </div>
      </Show>

      <Show when={phase() === "lobby"}>
        <div class="container mx-auto p-4">
          <h1 class="text-2xl font-bold mb-4">{roomSync.state().roomName || "Bomberman Room"}</h1>
          <p class="text-sm text-gray-500 mb-4">
            Players: {roomSync.state().players?.length ?? 0}/{roomSync.state().maxPlayers}
          </p>
          {isHost() && (
            <div class="mb-4">
              <button class="btn btn-sm btn-ghost" onClick={() => setShowSettings(!showSettings())}>
                {showSettings() ? "Hide" : "Show"} Settings
              </button>
              <Show when={showSettings()}>
                <div class="grid grid-cols-2 gap-3 mt-2 p-3 bg-base-300 rounded">
                  <div>
                    <label class="label text-xs"><span class="label-text">Players</span></label>
                    <select class="select select-sm w-full" value={roomSync.state().maxPlayers} onChange={(e) => {
                      roomSync.dispatch({ type: "CHANGE_CONFIG", payload: { playerLimit: Number(e.currentTarget.value) } } as any);
                    }}>
                      {[2, 3, 4].map((n) => <option value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label class="label text-xs"><span class="label-text">Round Time (s)</span></label>
                    <select class="select select-sm w-full" value={roomSync.state().config?.roundTimeSec ?? 180} onChange={(e) => {
                      roomSync.dispatch({ type: "CHANGE_CONFIG", payload: { roundTimeSec: Number(e.currentTarget.value) } } as any);
                    }}>
                      {[60, 120, 180, 300, 600].map((n) => <option value={n}>{n}s</option>)}
                    </select>
                  </div>
                  <div>
                    <label class="label text-xs"><span class="label-text">Map Size</span></label>
                    <select class="select select-sm w-full" value={roomSync.state().config?.mapWidth ?? 11} onChange={(e) => {
                      const v = Number(e.currentTarget.value);
                      roomSync.dispatch({ type: "CHANGE_CONFIG", payload: { mapWidth: v, mapHeight: v } } as any);
                    }}>
                      <option value={9}>Small (9x9)</option>
                      <option value={11}>Medium (11x11)</option>
                      <option value={15}>Large (15x15)</option>
                    </select>
                  </div>
                  <div>
                    <label class="label text-xs"><span class="label-text">Bombs</span></label>
                    <select class="select select-sm w-full" value={roomSync.state().config?.bombLimit ?? 1} onChange={(e) => {
                      roomSync.dispatch({ type: "CHANGE_CONFIG", payload: { bombLimit: Number(e.currentTarget.value) } } as any);
                    }}>
                      {[1, 2, 3].map((n) => <option value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
              </Show>
            </div>
          )}
          <div class="grid gap-2 mb-4">
            {(roomSync.state().players ?? []).map((p) => (
              <div class="flex items-center gap-2 p-2 bg-base-200 rounded pixel-border">
                <span class="font-bold">
                  {p.name}
                  {p.isHost ? " \u2605" : ""}
                </span>
                <span class={p.ready ? "badge badge-success" : "badge badge-ghost"}>
                  {p.ready ? "Ready" : "Waiting"}
                </span>
                {isHost() && p.id !== playerId() && (
                  <button
                    class="btn btn-xs btn-error ml-auto"
                    onClick={() => roomSync.dispatch({ type: "KICK_PLAYER", targetId: p.id } as any)}
                  >
                    Kick
                  </button>
                )}
              </div>
            ))}
          </div>
          <div class="flex gap-2">
            <button class="btn btn-primary" onClick={toggleReady}>
              {selfPlayer()?.ready ? "Unready" : "Ready"}
            </button>
            {isHost() && (
              <button class="btn btn-success" disabled={!allReady()} onClick={startGame}>
                Start Game
              </button>
            )}
          </div>
        </div>
      </Show>

      <Show when={phase() === "playing" && gameSync.state()}>
        <BombermanGame
          initialState={gameSync.state()}
          onAction={handleGameAction}
          onBackToRoom={() => {
            setPhase("lobby");
            gameSync.disconnect();
          }}
        />
      </Show>

      <Show when={phase() === "ended"}>
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div class="bg-base-200 p-8 rounded pixel-border text-center">
            <h2 class="text-2xl font-bold mb-4">Game Over</h2>
            {gameOver() && (
              <div class="mb-4">
                <p class="text-lg mb-2">Winner: {gameOver()!.winnerId ?? "Draw"}</p>
                {(gameOver()!.rankings ?? []).map((r) => (
                  <p>#{r.rank}: {r.playerId.slice(0, 8)}</p>
                ))}
              </div>
            )}
            <button class="btn btn-primary" onClick={() => navigate("/bomberman")}>
              Back to Lobby
            </button>
          </div>
        </div>
      </Show>
    </ProtectedRoute>
  );
}
