import { BombermanPreGameServerEventType } from "@generale/types";
import type {
  BombermanRoomState,
  BombermanPreGameClientAction,
  BombermanPreGameClientDispatch,
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
    rankings: { playerId: string; name: string; rank: number }[];
    winnerId: string | null;
  } | null>(null);

  const roomDomain = `room-${params.id}`;
  const gameDomain = `game-${params.id}`;

  // Read password from URL search params
  const urlPassword = new URLSearchParams(window.location.search).get("password") || undefined;

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
    openPayload: urlPassword ? { password: urlPassword } : {},
    onCustomEvent: (evt) => {
      const e = evt as BombermanPreGameServerEvent;
      if (e.type === BombermanPreGameServerEventType.GAME_STARTED) {
        setPhase("playing");
        setTimeout(() => gameSync.connect(), 500);
      }
      if (e.type === BombermanPreGameServerEventType.GAME_ENDED) {
        setGameOver({ rankings: e.rankings, winnerId: e.winnerId });
        setPhase("ended");
        gameSync.disconnect();
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
          <button type="button" class="btn" onClick={() => navigate("/bomberman")}>
            Back to Lobby
          </button>
        </div>
      </Show>

      <Show when={phase() === "lobby"}>
        <div class="container mx-auto p-4 max-w-2xl">
          <div class="flex items-center gap-3 mb-4">
            <h1 class="text-2xl font-bold">{roomSync.state().roomName || "Bomberman Room"}</h1>
            <span class="badge badge-outline text-xs font-mono">{params.id}</span>
          </div>

          <p class="text-sm text-gray-500 mb-4">
            Players: {roomSync.state().players?.length ?? 0}/{roomSync.state().maxPlayers}{" "}
            {(roomSync.state().players?.length ?? 0) < 2 && <span class="text-warning">(need 2+ to start)</span>}
          </p>

          {isHost() && (
            <div class="mb-4">
              <button type="button" class="btn btn-sm btn-ghost" onClick={() => setShowSettings(!showSettings())}>
                <svg class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <title>Settings</title>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                {showSettings() ? "Hide" : "Show"} Settings
              </button>
              <Show when={showSettings()}>
                <div class="grid grid-cols-2 gap-3 mt-2 p-4 bg-base-300 rounded">
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">Max Players</span>
                    </div>
                    <select
                      class="select select-sm w-full"
                      value={roomSync.state().maxPlayers}
                      onChange={(e) =>
                        roomSync.dispatch({
                          type: "CHANGE_CONFIG",
                          payload: { playerLimit: Number(e.currentTarget.value) },
                        } as BombermanPreGameClientDispatch)
                      }
                    >
                      {[2, 3, 4].map((n) => (
                        <option value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">Round Time</span>
                    </div>
                    <select
                      class="select select-sm w-full"
                      value={roomSync.state().config?.roundTimeSec ?? 180}
                      onChange={(e) =>
                        roomSync.dispatch({
                          type: "CHANGE_CONFIG",
                          payload: { roundTimeSec: Number(e.currentTarget.value) },
                        } as BombermanPreGameClientDispatch)
                      }
                    >
                      {[60, 120, 180, 300, 600].map((n) => (
                        <option value={n}>{n}s</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">Map Size</span>
                    </div>
                    <select
                      class="select select-sm w-full"
                      value={roomSync.state().config?.mapWidth ?? 11}
                      onChange={(e) => {
                        const v = Number(e.currentTarget.value);
                        roomSync.dispatch({
                          type: "CHANGE_CONFIG",
                          payload: { mapWidth: v, mapHeight: v },
                        } as BombermanPreGameClientDispatch);
                      }}
                    >
                      <option value={9}>Small (9x9)</option>
                      <option value={11}>Medium (11x11)</option>
                      <option value={15}>Large (15x15)</option>
                    </select>
                  </div>
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">Bombs</span>
                    </div>
                    <select
                      class="select select-sm w-full"
                      value={roomSync.state().config?.bombLimit ?? 1}
                      onChange={(e) =>
                        roomSync.dispatch({
                          type: "CHANGE_CONFIG",
                          payload: { bombLimit: Number(e.currentTarget.value) },
                        } as BombermanPreGameClientDispatch)
                      }
                    >
                      {[1, 2, 3].map((n) => (
                        <option value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Show>
            </div>
          )}

          <div class="grid gap-2 mb-4">
            {(roomSync.state().players ?? []).map((p) => (
              <div class="flex items-center gap-3 p-3 bg-base-200 rounded pixel-border">
                <div class="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center text-sm font-bold text-base-content/60">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1">
                  <div class="font-bold">
                    {p.name}
                    {p.isHost && <span class="text-xs text-warning ml-1">HOST</span>}
                  </div>
                  <div class="text-xs text-base-content/50">{p.ready ? "Ready" : "Not Ready"}</div>
                </div>
                <span class={p.ready ? "badge badge-success badge-sm" : "badge badge-ghost badge-sm"}>
                  {p.ready ? "Ready" : "Wait"}
                </span>
                {isHost() && p.id !== playerId() && (
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost text-error"
                    onClick={() =>
                      roomSync.dispatch({ type: "KICK_PLAYER", targetId: p.id } as BombermanPreGameClientDispatch)
                    }
                  >
                    Kick
                  </button>
                )}
              </div>
            ))}
          </div>

          <div class="flex gap-2 items-center">
            {selfPlayer()?.isHost ? (
              <span class="badge badge-success badge-lg">Host (Ready)</span>
            ) : selfPlayer()?.ready ? (
              <button
                type="button"
                class="btn btn-sm btn-outline"
                onClick={() => roomSync.dispatch({ type: "UNREADY" })}
              >
                Unready
              </button>
            ) : (
              <button type="button" class="btn btn-sm btn-primary" onClick={() => roomSync.dispatch({ type: "READY" })}>
                Ready
              </button>
            )}
            {isHost() && (
              <>
                <button type="button" class="btn btn-success" disabled={!allReady()} onClick={startGame}>
                  Start Game
                </button>
                {!allReady() && <span class="text-xs text-base-content/50">Need all players ready (min 2)</span>}
              </>
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
          playerId={playerId()}
        />
      </Show>

      <Show when={phase() === "ended"}>
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div class="bg-base-200 p-8 rounded pixel-border text-center">
            <h2 class="text-2xl font-bold mb-4">Game Over</h2>
            {gameOver() && (
              <div class="mb-4">
                {(() => {
                  const winnerName = gameOver()!.rankings.find((r) => r.playerId === gameOver()!.winnerId)?.name;
                  return <p class="text-lg mb-2">Winner: {winnerName ?? "Draw"}</p>;
                })()}
                {(gameOver()!.rankings ?? []).map((r) => (
                  <p>
                    #{r.rank}: {r.name}
                  </p>
                ))}
              </div>
            )}
            <button type="button" class="btn btn-primary" onClick={() => navigate("/bomberman")}>
              Back to Lobby
            </button>
          </div>
        </div>
      </Show>
    </ProtectedRoute>
  );
}
