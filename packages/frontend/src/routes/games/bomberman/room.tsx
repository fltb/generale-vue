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
import { useSyncedState } from "~/hooks/useSyncedState";
import { BombermanGame } from "./game";

export function BombermanRoom() {
  const params = useParams();
  const navigate = useNavigate();
  const [playerId, setPlayerId] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal("");
  const [showGame, setShowGame] = createSignal(false);
  const [gameOver, setGameOver] = createSignal<{
    rankings: { playerId: string; rank: number }[];
    winnerId: string | null;
  } | null>(null);
  const [showScoreboard, setShowScoreboard] = createSignal(false);

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
      if (evt.type === BombermanPreGameServerEventType.GAME_STARTED) {
        setShowGame(true);
        setTimeout(() => gameSync.connect(), 500);
      }
      if (evt.type === BombermanPreGameServerEventType.GAME_ENDED) {
        setGameOver(evt.payload);
        setShowScoreboard(true);
      }
      if (evt.type === BombermanPreGameServerEventType.KICKED)
        setError("You were kicked from the room");
      if (evt.type === BombermanPreGameServerEventType.ROOM_DISBANDED)
        setError("Room has been disbanded");
    },
    onConnectionClosed: () => setError("Connection lost"),
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
      if (!d.success || !d.data) {
        setError(d.message || "Failed to connect");
        setLoading(false);
        return;
      }
      setPlayerId(d.data.playerId);
      setLoading(false);
      if (d.data.phase === "playing") {
        setShowGame(true);
        gameSync.connect();
      } else {
        roomSync.connect();
      }
    } catch {
      setError("Network error");
      setLoading(false);
    }
  });

  const selfPlayer = createMemo(() =>
    (roomSync.state().players ?? []).find((p) => p.id === playerId()),
  );
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

  if (loading())
    return (
      <div class="p-8 text-center">
        <span class="loading loading-spinner loading-lg" />
      </div>
    );
  if (error())
    return (
      <div class="p-8 text-center">
        <div class="alert alert-error mb-4">{error()}</div>
        <button class="btn" onClick={() => navigate("/bomberman")}>
          Back to Lobby
        </button>
      </div>
    );

  return (
    <div class="container mx-auto p-4">
      <Show when={!showGame()}>
        <h1 class="text-2xl font-bold mb-4">
          {roomSync.state().roomName || "Bomberman Room"}
        </h1>
        <p class="text-sm text-gray-500 mb-4">
          Players: {roomSync.state().players?.length ?? 0}/{roomSync.state().maxPlayers}
        </p>
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
                  onClick={() => {
                    roomSync.dispatch({ type: "KICK_PLAYER", targetId: p.id } as any);
                  }}
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
      </Show>

      <Show when={showGame() && gameSync.state()}>
        <BombermanGame
          initialState={gameSync.state()}
          onAction={handleGameAction}
          onBackToRoom={() => {
            setShowGame(false);
            setShowScoreboard(false);
          }}
        />
      </Show>

      <Show when={showScoreboard()}>
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div class="bg-base-200 p-8 rounded pixel-border text-center">
            <h2 class="text-2xl font-bold mb-4">Game Over</h2>
            {gameOver() && (
              <div class="mb-4">
                <p class="text-lg mb-2">
                  Winner: {gameOver()!.winnerId ?? "Draw"}
                </p>
                {(gameOver()!.rankings ?? []).map((r) => (
                  <p>
                    #{r.rank}: {r.playerId.slice(0, 8)}
                  </p>
                ))}
              </div>
            )}
            <button class="btn btn-primary" onClick={() => navigate("/bomberman")}>
              Back to Lobby
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
