import type { BombermanPreGameClientDispatch } from "@generale/types";
import { useParams, useNavigate } from "@solidjs/router";
import { createMemo, createEffect, createSignal, Show, For, Switch, Match } from "solid-js";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { BombermanGame } from "./game";
import { useT } from "~/i18n/useT";
import { Button, Badge, Alert, Select, Spinner, Card, Input } from "~/ui";
import { useBombermanRoomSession } from "./hooks/useBombermanRoomSession";
import { TakeoverOverlay } from "~/ui/Overlay";
import ChatPanel from "~/components/ChatPanel";

export function BombermanRoom() {
  const { t } = useT();
  const params = useParams();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = createSignal(false);
  const [chatVisible, setChatVisible] = createSignal(false);

  // Read password from URL search params
  const urlPassword = new URLSearchParams(window.location.search).get("password") || undefined;

  const session = useBombermanRoomSession({ id: params.id ?? "", password: urlPassword });

  const selfPlayer = createMemo(() =>
    (session.roomSync.state().players ?? []).find((p) => p.id === session.playerId()),
  );
  const isHost = createMemo(() => selfPlayer()?.isHost ?? false);
  const allReady = createMemo(() => {
    const players = session.roomSync.state().players ?? [];
    return players.length >= 2 && players.every((p) => p.ready);
  });

  function startGame() {
    if (isHost() && allReady()) session.startGame();
  }

  const winnerName = createMemo(() => {
    const ge = session.gameEnded();
    if (!ge) return null;
    return ge.rankings.find((r) => r.playerId === ge.winnerId)?.name ?? null;
  });

  // ── Auto-dismiss game ended overlay after 5s ──
  const GAME_END_AUTO_DISMISS_MS = 5000;
  let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
  createEffect(() => {
    if (session.phase() === "ended") {
      autoDismissTimer = setTimeout(() => {
        navigate("/bomberman");
      }, GAME_END_AUTO_DISMISS_MS);
    }
    return () => {
      if (autoDismissTimer) {
        clearTimeout(autoDismissTimer);
        autoDismissTimer = null;
      }
    };
  });

  function handleDismissGameEnd() {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }
    navigate("/bomberman");
  }

  return (
    <ProtectedRoute>
      <Show when={session.phase() === "loading"}>
        <div class="p-8 text-center">
          <Spinner size="lg" />
        </div>
      </Show>

      <Show when={session.phase() === "error"}>
        <div class="p-8 text-center">
          <Alert variant="error" class="mb-4">
            {session.error()}
          </Alert>
          <Button onClick={() => navigate("/bomberman")}>{t("bomberman.backToLobby")}</Button>
        </div>
      </Show>

      <Show when={session.needsPassword()}>
        <Card class="p-6 max-w-md mx-auto mt-8">
          <h2 class="text-lg font-semibold mb-4">{t("Room requires password")}</h2>
          <Show
            when={session.wrongPassword()}
            fallback={<p class="text-sm opacity-70 mb-4">{t("Password required")}</p>}
          >
            <p class="text-error text-sm mb-4">{t("Wrong password, try again")}</p>
          </Show>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const pw = (e.target as HTMLFormElement).elements.namedItem("pw") as HTMLInputElement;
              if (pw.value.trim()) session.setPassword(pw.value.trim());
            }}
          >
            <div class="flex items-center gap-2">
              <Input bordered type="password" name="pw" placeholder={t("Enter room password")} class="w-64" />
              <Button variant="primary" type="submit">
                {t("Join")}
              </Button>
            </div>
          </form>
        </Card>
      </Show>

      <Show
        when={
          !session.needsPassword() &&
          (session.phase() === "lobby" || (session.phase() === "playing" && session.selfStatus() !== "playing"))
        }
      >
        <div class="container mx-auto p-4 max-w-2xl">
          <div class="flex items-center gap-3 mb-4">
            <h1 class="text-2xl font-bold">{session.roomSync.state().roomName || t("bomberman.title")}</h1>
            <Badge variant="outline" class="text-xs font-mono">
              {params.id}
            </Badge>
          </div>

          <p class="text-sm text-gray-500 mb-4">
            {t("bomberman.players")}: {session.roomSync.state().players?.length ?? 0}/
            {session.roomSync.state().maxPlayers}{" "}
            {(session.roomSync.state().players?.length ?? 0) < 2 && (
              <span class="text-warning">({t("bomberman.needMin")})</span>
            )}
          </p>

          {/* Game in progress alert — show when phase is playing but self is not playing */}
          <Show when={session.phase() === "playing"}>
            <Alert variant="info" class="mb-4">
              <div class="flex items-center justify-between w-full gap-3">
                <div>
                  <div class="font-medium">{t("bomberman.gameInProgress") || "Game in Progress"}</div>
                  <div class="text-sm opacity-70">
                    <Show
                      when={session.selfStatus() === "lobby"}
                      fallback={t("bomberman.youAreSpectating") || "You are spectating."}
                    >
                      {t("bomberman.waitOrSpectate") || "You can wait for the game to end, or enter spectator mode."}
                    </Show>
                  </div>
                </div>
                <Show when={session.selfStatus() === "lobby"}>
                  <Button size="sm" variant="primary" onClick={() => session.enterSpectate()}>
                    {t("bomberman.watchGame") || "Watch Game"}
                  </Button>
                </Show>
                <Show when={session.selfStatus() === "spectating"}>
                  <Button size="sm" variant="ghost" onClick={() => session.leaveSpectate()}>
                    {t("bomberman.leaveSpectate") || "Leave Spectate"}
                  </Button>
                </Show>
              </div>
            </Alert>
          </Show>

          <Show when={isHost() && session.phase() === "lobby"}>
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
                      value={session.roomSync.state().maxPlayers}
                      onChange={(e) =>
                        session.roomSync.dispatch({
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
                      value={session.roomSync.state().config?.roundTimeSec ?? 180}
                      onChange={(e) =>
                        session.roomSync.dispatch({
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
                      value={session.roomSync.state().config?.mapWidth ?? 11}
                      onChange={(e) => {
                        const v = Number(e.currentTarget.value);
                        session.roomSync.dispatch({
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
                      value={session.roomSync.state().config?.bombLimit ?? 1}
                      onChange={(e) =>
                        session.roomSync.dispatch({
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
          </Show>

          <div class="grid gap-2 mb-4">
            <For each={session.roomSync.state().players ?? []}>
              {(p) => (
                <div class="flex items-center gap-3 p-3 bg-base-200 rounded pixel-border">
                  <div class="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center text-sm font-bold text-base-content/60">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div class="flex-1">
                    <div class="font-bold">
                      {p.name}
                      <Show when={p.isHost}>
                        <span class="text-xs text-warning ml-1">{t("bomberman.host")}</span>
                      </Show>
                      <Show when={p.status === "spectating"}>
                        <span class="text-xs text-info ml-1">({t("bomberman.spectating") || "Spectating"})</span>
                      </Show>
                    </div>
                    <div class="text-xs text-base-content/50">
                      {p.ready ? t("bomberman.ready") : t("bomberman.notReady")}
                    </div>
                  </div>
                  <Badge variant={p.ready ? "success" : "neutral"} size="sm" ghost={!p.ready}>
                    {p.ready ? t("bomberman.ready") : t("bomberman.wait")}
                  </Badge>
                  <Show when={isHost() && p.id !== session.playerId()}>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="text-error"
                      onClick={() =>
                        session.roomSync.dispatch({
                          type: "KICK_PLAYER",
                          targetId: p.id,
                        } as BombermanPreGameClientDispatch)
                      }
                    >
                      {t("bomberman.kick")}
                    </Button>
                  </Show>
                </div>
              )}
            </For>
          </div>

          <div class="flex gap-2 items-center">
            <Switch>
              <Match when={selfPlayer()?.isHost && session.phase() === "lobby"}>
                <Badge variant="success" size="lg">
                  {t("bomberman.hostReady")}
                </Badge>
              </Match>
              <Match when={selfPlayer()?.ready}>
                <Button size="sm" outline onClick={() => session.roomSync.dispatch({ type: "UNREADY" })}>
                  {t("bomberman.unready")}
                </Button>
              </Match>
              <Match when={session.phase() === "lobby"}>
                <Button size="sm" variant="primary" onClick={() => session.roomSync.dispatch({ type: "READY" })}>
                  {t("bomberman.ready")}
                </Button>
              </Match>
            </Switch>
            <Show when={isHost() && session.phase() === "lobby"}>
              <Button variant="success" disabled={!allReady()} onClick={startGame}>
                {t("bomberman.startGame")}
              </Button>
              <Show when={!allReady()}>
                <span class="text-xs text-base-content/50">{t("bomberman.needAllReady")}</span>
              </Show>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={session.showingGameUI() && session.gameSync.state()}>
        <BombermanGame
          gameSync={session.gameSync}
          onBackToRoom={() => {
            // phase will be reset by server event or navigation
          }}
          playerId={session.playerId()}
          displaced={session.displaced}
          spectate={session.selfStatus() === "spectating"}
          onLeaveSpectate={() => session.leaveSpectate()}
          freshStart={session.startedThisSession()}
        />
      </Show>

      <Show when={session.phase() === "ended"}>
        <div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div class="bg-base-200 p-8 rounded pixel-border text-center">
            <h2 class="text-2xl font-bold mb-4">{t("bomberman.gameOver")}</h2>
            <Show when={session.gameEnded()}>
              <div class="mb-4">
                <p class="text-lg mb-2">
                  {t("bomberman.winner")}: {winnerName() ?? t("bomberman.draw")}
                </p>
                <For each={session.gameEnded()?.rankings ?? []}>
                  {(r) => (
                    <p>
                      #{r.rank}: {r.name}
                    </p>
                  )}
                </For>
              </div>
            </Show>
            <div class="flex gap-2 justify-center">
              <Button variant="primary" onClick={handleDismissGameEnd}>
                {t("bomberman.playAgain")}
              </Button>
              <Button outline onClick={handleDismissGameEnd}>
                {t("bomberman.backToLobby")}
              </Button>
            </div>
          </div>
        </div>
      </Show>
      {/* Floating chat window */}
      <Show when={session.chatDomain() && session.playerId()}>
        <div class="fixed bottom-4 right-4 z-50">
          <Show when={!chatVisible()}>
            <Button variant="primary" class="shadow-lg btn-circle" onClick={() => setChatVisible(true)}>
              💬
            </Button>
          </Show>
          <Show when={chatVisible()}>
            <div class="w-96 bg-base-100 shadow-xl pixel-border">
              <div class="flex justify-between p-2 border-b border-base-300">
                <span class="text-sm font-medium">Chat</span>
                <Button size="xs" variant="ghost" onClick={() => setChatVisible(false)}>
                  ✕
                </Button>
              </div>
              <div class="p-2">
                <ChatPanel domain={session.chatDomain() as string} userId={session.playerId() as string} />
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Takeover overlay — same user connected from another tab/device */}
      <Show when={session.displaced()}>
        <TakeoverOverlay scope="Room" dim={60} />
      </Show>
    </ProtectedRoute>
  );
}
