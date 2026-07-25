import type {
  BombermanMatchState,
  BombermanPreGameClientDispatch,
  BombermanMatchFormat,
  PreGameTeamMode,
  GamePhase,
  PreGamePlayerStatus,
  PreGameRoomState,
} from "@generale/types";
import { useParams, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, createEffect, onCleanup, Show, For, Switch, Match } from "solid-js";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { BombermanGame } from "./game";
import { useT } from "~/i18n/useT";
import { Button, Badge, Alert, Select, Spinner, Card, Input } from "~/ui";
import { useBombermanRoomSession } from "./hooks/useBombermanRoomSession";
import { getBombermanScoreRows, type BombermanScoreRow } from "./hooks/selectors";
import { Scoreboard } from "./components/Scoreboard";
import { TakeoverOverlay } from "~/ui/Overlay";
import ChatPanel from "~/components/ChatPanel";

interface BetweenRoundsStateProps {
  match: BombermanMatchState;
  scoreRows: BombermanScoreRow[];
  players: Array<{ id: string; name: string }>;
}

function BetweenRoundsState(props: BetweenRoundsStateProps) {
  const { t } = useT();
  const [countdown, setCountdown] = createSignal<number | null>(null);
  const lastRound = createMemo(() => props.match.roundResults[props.match.roundResults.length - 1] ?? null);
  let countdownTimer: number | undefined;

  createEffect(() => {
    window.clearInterval(countdownTimer);
    const deadline = props.match.nextRoundStartsAt;
    if (deadline == null) {
      countdownTimer = undefined;
      setCountdown(null);
      return;
    }
    const updateCountdown = () => {
      setCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    updateCountdown();
    countdownTimer = window.setInterval(updateCountdown, 500);
    onCleanup(() => {
      window.clearInterval(countdownTimer);
      countdownTimer = undefined;
    });
  });

  const winnerLabel = createMemo(() => {
    const winner = lastRound()?.winner;
    if (!winner) return t("bomberman.draw");
    if (winner.kind === "player") {
      return props.players.find((player) => player.id === winner.id)?.name ?? winner.id.slice(0, 8);
    }
    return winner.id.slice(0, 8);
  });

  return (
    <div
      data-testid="bomberman-between-rounds"
      class="fixed inset-0 z-40 flex items-center justify-center bg-black/70"
    >
      <div class="w-full max-w-md rounded border-2 border-gray-600 bg-gray-900 p-8 text-center pixel-border">
        <Show when={lastRound()}>
          {(round) => (
            <div class="mb-6">
              <div class="text-xl font-bold text-white">
                {t("bomberman.roundResult", {
                  n: String(round().roundNumber),
                  winner: winnerLabel(),
                })}
              </div>
            </div>
          )}
        </Show>

        <Show when={props.scoreRows.length > 0}>
          <div data-testid="bomberman-between-rounds-score" class="mb-6">
            <h2 class="mb-3 text-sm uppercase text-white/70">{t("bomberman.finalScore")}</h2>
            <div class="space-y-2">
              <For each={props.scoreRows}>
                {(row) => (
                  <div class="flex items-center justify-between rounded bg-white/5 px-3 py-1.5 text-lg text-white">
                    <span>{row.label}</span>
                    <span class="font-mono">
                      {row.wins} / {props.match.targetWins}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={countdown() !== null}>
          <div data-testid="bomberman-between-rounds-countdown">
            <div class="font-mono text-4xl font-bold text-yellow-400">{countdown()}</div>
            <div class="mt-1 text-sm text-white/70">
              {t("bomberman.nextRoundIn", { s: String(countdown() ?? 0) })}
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}

export function BombermanRoom() {
  const { t } = useT();
  const params = useParams();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = createSignal(false);
  const [chatVisible, setChatVisible] = createSignal(false);

  // Read password from URL search params
  const urlPassword = new URLSearchParams(window.location.search).get("password") || undefined;
  // Read role from URL search params (e.g., ?role=spectator)
  const urlRoleParam = new URLSearchParams(window.location.search).get("role") as "player" | "spectator" | null;

  const session = useBombermanRoomSession({
    id: params.id ?? "",
    password: urlPassword,
    role: urlRoleParam ?? undefined,
  });

  const selfPlayer = createMemo(() =>
    (session.roomSync.state().players ?? []).find((p) => p.id === session.playerId()),
  );
  const isHost = createMemo(() => selfPlayer()?.isHost ?? false);
  const allReady = createMemo(() => {
    const players = session.roomSync.state().players ?? [];
    return players.length >= 2 && players.every((p) => p.ready);
  });

  const teamMode = createMemo<PreGameTeamMode>(() => session.roomSync.state().config?.teamMode ?? "ffa");
  const teamColors: Record<string, string> = {
    team1: "#3b82f6",
    team2: "#ef4444",
    team3: "#22c55e",
    team4: "#a855f7",
  };
  const teamMarkers: Record<string, string> = {
    team1: "\u25CF circle",
    team2: "\u25B3 triangle",
    team3: "\u25A0 square",
    team4: "\u25C6 diamond",
  };

  function handleTeamModeChange(e: Event) {
    const teamMode = (e.currentTarget as HTMLSelectElement).value as PreGameTeamMode;
    session.roomSync.dispatch({ type: "CHANGE_TEAM_MODE", teamMode } as BombermanPreGameClientDispatch);
  }

  function handleTeamSwitch(playerId: string, teamId: string) {
    session.roomSync.dispatch({
      type: "CHANGE_TEAM",
      playerId,
      teamId,
    } as BombermanPreGameClientDispatch);
  }

  function startGame() {
    if (isHost() && allReady()) session.startGame();
  }
  function handleDismissGameEnd() {
    session.handleDismissGameEnd();
  }

  // Compute score rows from match state
  const scoreRows = createMemo(() => getBombermanScoreRows(session.roomSync.state()));

  const matchState = createMemo(() => session.roomSync.state().match);

  // Room player list for scoreboard
  const playerListMemo = createMemo(() => {
    return (session.roomSync.state().players ?? []).map((p) => ({ id: p.id, name: p.name }));
  });

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
                      <span class="label-text">{t("bomberman.matchFormat")}</span>
                    </div>
                    <Select
                      size="sm"
                      class="w-full"
                      value={matchState()?.format ?? "single"}
                      onChange={(e) =>
                        session.roomSync.dispatch({
                          type: "CHANGE_CONFIG",
                          payload: { matchFormat: e.currentTarget.value as BombermanMatchFormat },
                        } as BombermanPreGameClientDispatch)
                      }
                    >
                      <option value="single">{t("bomberman.single")}</option>
                      <option value="bo3">{t("bomberman.bo3")}</option>
                      <option value="bo5">{t("bomberman.bo5")}</option>
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
                  <div>
                    <div class="label text-xs">
                      <span class="label-text">Team Mode</span>
                    </div>
                    <Select size="sm" class="w-full" value={teamMode()} onChange={handleTeamModeChange}>
                      <option value="ffa">Free-for-All</option>
                      <option value="team">Teams</option>
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
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ "background-color": teamColors[p.teamId] ?? "#666" }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold flex items-center gap-2">
                      {p.name}
                      <Show when={teamMode() === "team" && p.teamId}>
                        <span
                          class="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            "background-color": `${teamColors[p.teamId] ?? "#666"}33`,
                            color: teamColors[p.teamId] ?? "#666",
                          }}
                        >
                          {teamMarkers[p.teamId]?.split(" ")[1] ?? p.teamId}
                        </span>
                      </Show>
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
                  <Show
                    when={
                      teamMode() === "team" && session.phase() === "lobby" && (isHost() || p.id === session.playerId())
                    }
                  >
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center border"
                        style={{
                          "background-color": p.teamId === "team1" ? "#3b82f6" : "transparent",
                          "border-color": "#3b82f6",
                          color: p.teamId === "team1" ? "#fff" : "#3b82f6",
                        }}
                        onClick={() => handleTeamSwitch(p.id, "team1")}
                        title="Switch to Team Alpha"
                      >
                        A
                      </button>
                      <button
                        type="button"
                        class="w-6 h-6 rounded text-xs font-bold flex items-center justify-center border"
                        style={{
                          "background-color": p.teamId === "team2" ? "#ef4444" : "transparent",
                          "border-color": "#ef4444",
                          color: p.teamId === "team2" ? "#fff" : "#ef4444",
                        }}
                        onClick={() => handleTeamSwitch(p.id, "team2")}
                        title="Switch to Team Beta"
                      >
                        B
                      </button>
                    </div>
                  </Show>
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
      <Show when={session.showingGameUI() && session.phase() === "between_rounds" && matchState()}>
        {(match) => (
          <BetweenRoundsState match={match()} scoreRows={scoreRows()} players={playerListMemo()} />
        )}
      </Show>

      <Show when={session.showingGameUI() && session.gameSync.state()}>
        <BombermanGame
          gameSync={session.gameSync}
          onBackToRoom={() => {
            handleDismissGameEnd();
          }}
          playerId={session.playerId()}
          displaced={session.displaced}
          spectate={session.selfStatus() === "spectating"}
          onLeaveSpectate={() => session.leaveSpectate()}
          freshStart={session.startedThisSession()}
          phase={session.phase() === "between_rounds" ? "between_rounds" : "playing"}
          matchState={matchState()}
          scoreRows={scoreRows()}
          chatDomain={session.chatDomain()}
          selfStatus={session.selfStatus()}
        />
      </Show>

      <Show when={session.phase() === "ended" && matchState()}>
        {(match) => (
          <Show when={session.matchRankings()}>
            {(rankings) => (
              <Scoreboard
                match={match()}
                rankings={rankings()}
                players={playerListMemo()}
                onBackToRoom={handleDismissGameEnd}
              />
            )}
          </Show>
        )}
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
              <ChatPanel
                domain={session.chatDomain() as string}
                userId={session.playerId() as string}
                phase={session.phase() as GamePhase | undefined}
                selfStatus={session.selfStatus() as PreGamePlayerStatus | undefined}
                room={session.roomSync.state() as unknown as PreGameRoomState | null}
                quickMessageKeys={["help", "danger", "nice", "follow_me"]}
                transparent
                scopes={["room", "game", "team"]}
                activeScope={null}
                onScopeChange={() => {}}
              />
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
