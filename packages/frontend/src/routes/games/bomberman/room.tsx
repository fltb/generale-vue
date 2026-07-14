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
import { useT } from "~/i18n/useT";
import { Button, Badge, Alert, Select, Spinner } from "~/ui";

export function BombermanRoom() {
  const { t } = useT();
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
        setError(t("You have been kicked from the room"));
        setPhase("error");
      }
      if (e.type === BombermanPreGameServerEventType.ROOM_DISBANDED) {
        setError(t("The room has been disbanded"));
        setPhase("error");
      }
    },
    onConnectionClosed: () => {
      setError(t("bomberman.connectionLost"));
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
        setError(d.message || t("Failed to connect"));
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
      setError(t("Network error"));
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
          <Spinner size="lg" />
        </div>
      </Show>

      <Show when={phase() === "error"}>
        <div class="p-8 text-center">
          <Alert variant="error" class="mb-4">
            {error()}
          </Alert>
          <Button onClick={() => navigate("/bomberman")}>{t("bomberman.backToLobby")}</Button>
        </div>
      </Show>

      <Show when={phase() === "lobby"}>
        <div class="container mx-auto p-4 max-w-2xl">
          <div class="flex items-center gap-3 mb-4">
            <h1 class="text-2xl font-bold">{roomSync.state().roomName || t("bomberman.title")}</h1>
            <Badge variant="outline" class="text-xs font-mono">
              {params.id}
            </Badge>
          </div>

          <p class="text-sm text-gray-500 mb-4">
            {t("bomberman.players")}: {roomSync.state().players?.length ?? 0}/{roomSync.state().maxPlayers}{" "}
            {(roomSync.state().players?.length ?? 0) < 2 && (
              <span class="text-warning">({t("bomberman.needMin")})</span>
            )}
          </p>

          {isHost() && (
            <div class="mb-4">
              <Button size="sm" variant="ghost" onClick={() => setShowSettings(!showSettings())}>
                <svg class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <title>{t("bomberman.settings")}</title>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                {showSettings() ? `${t("bomberman.settings")} ▾` : t("bomberman.settings")}
              </Button>
              <Show when={showSettings()}>
                <div class="grid grid-cols-2 gap-3 mt-2 p-4 bg-base-300 rounded">
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">{t("bomberman.maxPlayers")}</span>
                    </div>
                    <Select
                      size="sm"
                      class="w-full"
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
                    </Select>
                  </div>
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">{t("bomberman.roundTimeSec")}</span>
                    </div>
                    <Select
                      size="sm"
                      class="w-full"
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
                    </Select>
                  </div>
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">{t("bomberman.mapSize")}</span>
                    </div>
                    <Select
                      size="sm"
                      class="w-full"
                      value={roomSync.state().config?.mapWidth ?? 11}
                      onChange={(e) => {
                        const v = Number(e.currentTarget.value);
                        roomSync.dispatch({
                          type: "CHANGE_CONFIG",
                          payload: { mapWidth: v, mapHeight: v },
                        } as BombermanPreGameClientDispatch);
                      }}
                    >
                      <option value={9}>{t("bomberman.small")} (9x9)</option>
                      <option value={11}>{t("bomberman.medium")} (11x11)</option>
                      <option value={15}>{t("bomberman.large")} (15x15)</option>
                    </Select>
                  </div>
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">{t("bomberman.bombLimit")}</span>
                    </div>
                    <Select
                      size="sm"
                      class="w-full"
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
                    </Select>
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
                    {p.isHost && <span class="text-xs text-warning ml-1">{t("bomberman.host")}</span>}
                  </div>
                  <div class="text-xs text-base-content/50">
                    {p.ready ? t("bomberman.ready") : t("bomberman.notReady")}
                  </div>
                </div>
                <Badge variant={p.ready ? "success" : "neutral"} size="sm" ghost={!p.ready}>
                  {p.ready ? t("bomberman.ready") : t("bomberman.wait")}
                </Badge>
                {isHost() && p.id !== playerId() && (
                  <Button
                    size="xs"
                    variant="ghost"
                    class="text-error"
                    onClick={() =>
                      roomSync.dispatch({ type: "KICK_PLAYER", targetId: p.id } as BombermanPreGameClientDispatch)
                    }
                  >
                    {t("bomberman.kick")}
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div class="flex gap-2 items-center">
            {selfPlayer()?.isHost ? (
              <Badge variant="success" size="lg">
                {t("bomberman.hostReady")}
              </Badge>
            ) : selfPlayer()?.ready ? (
              <Button size="sm" outline onClick={() => roomSync.dispatch({ type: "UNREADY" })}>
                {t("bomberman.unready")}
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={() => roomSync.dispatch({ type: "READY" })}>
                {t("bomberman.ready")}
              </Button>
            )}
            {isHost() && (
              <>
                <Button variant="success" disabled={!allReady()} onClick={startGame}>
                  {t("bomberman.startGame")}
                </Button>
                {!allReady() && <span class="text-xs text-base-content/50">{t("bomberman.needAllReady")}</span>}
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
            <h2 class="text-2xl font-bold mb-4">{t("bomberman.gameOver")}</h2>
            {gameOver() && (
              <div class="mb-4">
                {(() => {
                  const winnerName = gameOver()!.rankings.find((r) => r.playerId === gameOver()!.winnerId)?.name;
                  return (
                    <p class="text-lg mb-2">
                      {t("bomberman.winner")}: {winnerName ?? t("bomberman.draw")}
                    </p>
                  );
                })()}
                {(gameOver()!.rankings ?? []).map((r) => (
                  <p>
                    #{r.rank}: {r.name}
                  </p>
                ))}
              </div>
            )}
            <div class="flex gap-2 justify-center">
              <Button variant="primary" onClick={() => setPhase("lobby")}>
                {t("bomberman.playAgain")}
              </Button>
              <Button outline onClick={() => navigate("/bomberman")}>
                {t("bomberman.backToLobby")}
              </Button>
            </div>
          </div>
        </div>
      </Show>
    </ProtectedRoute>
  );
}
