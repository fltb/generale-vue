import { Application } from "solid-pixi";
import { type Accessor, createSignal, createMemo, createEffect, onMount, onCleanup, Show } from "solid-js";
import type { BombermanState, BombermanOperation, BombermanMatchState, BombermanEvent } from "@generale/types";
import { bombermanSettingsSchema } from "@generale/types";
import { useBombermanInput } from "./hooks/useBombermanInput";
import { useGameSettings } from "~/hooks/useGameSettings";
import { MapLayer } from "./components/MapLayer";
import { EntityLayer } from "./components/EntityLayer";
import { HUD } from "./components/HUD";
import { VirtualControls } from "./components/VirtualControls";
import { Countdown } from "~/ui/Countdown";
import { sfx, isMuted } from "~/ui/sound";
import { formatKey } from "./utils";
import { useT } from "~/i18n/useT";
import { Button } from "~/ui";
import { TakeoverOverlay } from "~/ui/Overlay";
import type { SyncedState } from "./hooks/useBombermanRoomSession";
import { useBombermanGameSession } from "./hooks/useBombermanGameSession";
import { useBombermanEvents } from "./hooks/useBombermanEvents";
import { EventFeed } from "./components/EventFeed";
import { DeathOverlay } from "./components/DeathOverlay";
import { DangerIndicator } from "./components/DangerIndicator";
import ChatPanel from "~/components/ChatPanel";

interface ScoreRow {
  label: string;
  wins: number;
  isMatchPoint: boolean;
}

interface BombermanGameProps {
  gameSync: SyncedState<BombermanState, BombermanOperation>;
  onBackToRoom: () => void;
  playerId?: string;
  displaced?: Accessor<boolean>;
  spectate?: boolean;
  onLeaveSpectate?: () => void;
  freshStart?: boolean;
  phase?: "playing" | "between_rounds";
  matchState?: BombermanMatchState | null;
  scoreRows?: ScoreRow[];
  chatDomain?: string | null;
  selfStatus?: "lobby" | "playing" | "spectating";
}

export function BombermanGame(props: BombermanGameProps) {
  const { t } = useT();
  const session = useBombermanGameSession(props.gameSync, () => props.playerId ?? "", props.spectate);
  // ── Countdown (skip for spectators and reconnects) ──
  const [countdownDone, setCountdownDone] = createSignal(!props.freshStart);
  const { showVirtualControls, pressDirection, releaseDirection } = useBombermanInput({
    onAction: props.spectate ? () => {} : session.onAction,
    enabled: countdownDone,
    onMenu: () => setShowMenuOverlay(true),
  });
  // Gate virtual controls behind countdown
  const gatedOnAction = (op: BombermanOperation) => {
    if (!countdownDone()) return;
    session.onAction(op);
  };
  const { settings: gameSettings } = useGameSettings(bombermanSettingsSchema);

  // ── Spectator controls: follow/overview mode and follow target ──
  type SpectatorMode = "follow" | "overview";
  const [spectatorMode, setSpectatorMode] = createSignal<SpectatorMode>("overview");
  const [followTarget, setFollowTarget] = createSignal<string | null>(null);

  // Cycle follow target through alive players
  const cycleFollowTarget = () => {
    const alivePlayers = players().filter((p) => p.alive);
    if (alivePlayers.length === 0) {
      setSpectatorMode("overview");
      setFollowTarget(null);
      return;
    }
    const current = followTarget();
    const currentIdx = alivePlayers.findIndex((p) => p.playerId === current);
    const nextIdx = (currentIdx + 1) % alivePlayers.length;
    const next = alivePlayers[nextIdx];
    if (!next) return;
    setFollowTarget(next.playerId);
    setSpectatorMode("follow");
  };

  // When followed player dies, switch to next alive or overview
  createEffect(() => {
    if (spectatorMode() !== "follow") return;
    const target = followTarget();
    if (!target) return;
    const player = state().players?.[target];
    if (!player?.alive) {
      cycleFollowTarget();
    }
  });
  const [controlsAutoHidden, setControlsAutoHidden] = createSignal(false);
  const [gameChatVisible, setGameChatVisible] = createSignal(false);
  const [showControls, setShowControls] = createSignal(true);
  const [connectionOk, setConnectionOk] = createSignal(true);
  const [showMenuOverlay, setShowMenuOverlay] = createSignal(false);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = createSignal(false);
  // ── Between-rounds countdown ──
  const [nextRoundCountdown, setNextRoundCountdown] = createSignal<number | null>(null);
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  createEffect(() => {
    const m = props.matchState;
    if (props.phase !== "between_rounds" || !m?.nextRoundStartsAt) {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      setNextRoundCountdown(null);
      return;
    }
    const tick = () => {
      const deadline = m.nextRoundStartsAt;
      if (deadline == null) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setNextRoundCountdown(remaining);
    };
    tick();
    countdownTimer = setInterval(tick, 500);
  });
  onCleanup(() => {
    if (countdownTimer) clearInterval(countdownTimer);
  });

  const state = () => session.state();

  // ── Scale to fit viewport ──
  const TILE_SIZE = 36;
  const [gameScale, setGameScale] = createSignal(1);
  function calculateScale() {
    const s = state();
    if (!s?.map?.tiles) return;
    const cols = s.map.tiles[0]?.length ?? 0;
    const rows = s.map.tiles.length;
    const scaleW = (window.innerWidth * 0.85) / (cols * TILE_SIZE);
    const scaleH = (window.innerHeight * 0.8) / (rows * TILE_SIZE);
    // Overview: allow full-map fit (min 0.4); follow: enforce at least 1.5× default
    const minScale = props.spectate && spectatorMode() === "overview" ? 0.4 : 1;
    const maxScale = props.spectate && spectatorMode() === "follow" ? 3 : 3;
    setGameScale(Math.max(minScale, Math.min(scaleW, scaleH, maxScale)));
  }
  onMount(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
  });
  onCleanup(() => window.removeEventListener("resize", calculateScale));
  createEffect(() => {
    if (state()?.map?.tiles) calculateScale();
  });

  // ── Event-driven feedback ──
  const bombermanEvents = useBombermanEvents(state);
  const [eventsForFeedback, setEventsForFeedback] = createSignal<BombermanEvent[]>([]);

  // Detect reduced motion preference
  const [reducedMotion, setReducedMotion] = createSignal(false);
  onMount(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    onCleanup(() => mq.removeEventListener("change", handler));
  });

  // Consume events, play sounds (unless muted), and forward to UI components
  createEffect(() => {
    if (bombermanEvents.pendingEvents().length === 0) return;
    const events = bombermanEvents.consume();
    setEventsForFeedback((prev) => [...prev, ...events].slice(-20));

    if (!isMuted()) {
      for (const e of events) {
        switch (e.type) {
          case "elimination":
            sfx.death();
            break;
          case "item_picked_up":
            sfx.pickup();
            break;
          case "item_spawned":
            // item_spawned events are kept for visual, no sound by default
            break;
        }
      }
    }
  });

  onMount(() => {
    setTimeout(() => {
      setShowControls(false);
      setControlsAutoHidden(true);
    }, 6000);
  });

  // Tick-health monitor: starts after countdown, warns if no tick for >3s.
  // Server has a 3s pre-game delay — defer checks until the first real tick arrives.
  let lastTick = -1;
  let lastSeenTick = -1;
  let monitorTimer: ReturnType<typeof setInterval> | null = null;
  createEffect(() => {
    if (!countdownDone()) return;
    if (monitorTimer) return; // already running
    monitorTimer = setInterval(() => {
      const s = state();
      const currentTick = s?.tick ?? -1;
      const now = Date.now();
      // Track tick changes — reset timer on each new tick
      if (currentTick > lastSeenTick) {
        lastSeenTick = currentTick;
        if (currentTick > 0) lastTick = now;
      }
      // Don't check until we've seen the first real tick
      if (lastTick < 0) return;
      setConnectionOk(now - lastTick < 3000);
    }, 500);
  });
  onCleanup(() => {
    if (monitorTimer) clearInterval(monitorTimer);
  });

  const mapCols = createMemo(() => state().map?.tiles[0]?.length ?? 0);
  const mapRows = createMemo(() => state().map?.tiles.length ?? 0);
  const players = createMemo(() => Object.values(state().players ?? {}));
  const myPlayer = createMemo(() => (props.playerId ? state().players?.[props.playerId] : null));
  const myStats = createMemo(() => {
    const p = myPlayer();
    if (!p) return undefined;
    return { bombMax: p.bombMax, bombActive: p.bombActive, blastRadius: p.blastRadius, speed: p.speed };
  });
  const myItems = createMemo(() => myPlayer()?.items ?? []);

  return (
    <div class="w-full h-screen overflow-hidden bg-gray-900 flex items-center justify-center relative">
      <Show when={!countdownDone()}>
        <Countdown from={3} onDone={() => setCountdownDone(true)} />
      </Show>
      <div style={{ transform: `scale(${gameScale()})`, "transform-origin": "center" }}>
        <Show when={mapCols() > 0 && mapRows() > 0}>
          <Application
            width={mapCols() * TILE_SIZE}
            height={mapRows() * TILE_SIZE}
            resolution={window.devicePixelRatio}
            autoDensity
          >
            <MapLayer tiles={state().map?.tiles ?? []} />
            <EntityLayer
              players={players()}
              bombs={state().bombs ?? []}
              explosions={state().explosions ?? []}
              items={state().items ?? []}
              tickRate={state().config.tickRate}
            />
          </Application>
        </Show>
      </div>

      <HUD
        timeLeft={state().roundTimer ?? 0}
        aliveCount={players().filter((p) => p.alive).length}
        totalPlayers={players().length}
        playerStats={myStats()}
        playerItems={myItems()}
        matchState={props.matchState}
        scoreRows={props.scoreRows}
      />

      <EventFeed
        events={eventsForFeedback()}
        consume={() => setEventsForFeedback([])}
        players={state().players}
        localPlayerId={props.playerId}
        reducedMotion={reducedMotion()}
      />

      <DeathOverlay
        localPlayer={myPlayer()}
        playerId={props.playerId}
        events={eventsForFeedback()}
        players={state().players}
        reducedMotion={reducedMotion()}
        isRoomSpectator={props.spectate}
      />

      <DangerIndicator
        bombs={state().bombs ?? []}
        localPlayer={myPlayer()}
        tickRate={state().config.tickRate ?? 5}
        reducedMotion={reducedMotion()}
      />

      {/* Between-rounds overlay */}
      <Show when={props.phase === "between_rounds" && props.matchState}>
        <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div class="text-center">
            <Show when={props.matchState?.roundResults && props.matchState.roundResults.length > 0}>
              {(() => {
                const results = props.matchState?.roundResults ?? [];
                const last = results[results.length - 1];
                const winnerLabel = last.winner
                  ? last.winner.kind === "player"
                    ? last.winner.id.slice(0, 8)
                    : last.winner.id.slice(0, 8)
                  : t("bomberman.draw");
                return (
                  <div class="mb-4">
                    <div class="text-xl text-white font-bold mb-1">
                      {t("bomberman.roundResult", {
                        n: String(last.roundNumber),
                        winner: winnerLabel,
                      })}
                    </div>
                    <Show when={nextRoundCountdown() !== null}>
                      <div class="text-4xl text-yellow-400 font-bold font-mono animate-pulse">
                        {nextRoundCountdown()}
                      </div>
                      <div class="text-sm text-white/70 mt-1">
                        {t("bomberman.nextRoundIn", { s: String(nextRoundCountdown() ?? 0) })}
                      </div>
                    </Show>
                  </div>
                );
              })()}
            </Show>
          </div>
        </div>
      </Show>

      <Show when={!connectionOk()}>
        <div class="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-4 py-2 rounded z-40 text-sm font-bold pointer-events-none animate-pulse">
          {t("bomberman.connectionLost")}
        </div>
      </Show>

      <Show when={showControls()}>
        <div class="fixed bottom-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-4 rounded-lg z-40 text-sm text-center pointer-events-none transition-opacity duration-500">
          <div class="font-bold mb-2">{t("bomberman.controls")}</div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <span class="text-left">{t("bomberman.move")}</span>
            <span class="text-right font-mono">
              {formatKey(gameSettings().keybindings.up)}/{formatKey(gameSettings().keybindings.down)}/
              {formatKey(gameSettings().keybindings.left)}/{formatKey(gameSettings().keybindings.right)}
            </span>
            <span class="text-left">{t("bomberman.placeBomb")}</span>
            <span class="text-right font-mono">{formatKey(gameSettings().keybindings.placeBomb)}</span>
            <span class="text-left">{t("bomberman.action")}</span>
            <span class="text-right font-mono">{formatKey(gameSettings().keybindings.action)}</span>
            <span class="text-left">{t("bomberman.detonate")}</span>
            <span class="text-right font-mono">{formatKey(gameSettings().keybindings.detonate)}</span>
          </div>
        </div>
      </Show>
      <Show when={!props.spectate && showVirtualControls()}>
        <VirtualControls pressDirection={pressDirection} releaseDirection={releaseDirection} onAction={gatedOnAction} />
      </Show>
      {/* Spectate mode badge + leave button */}
      {/* Spectator controls — shown for room-spectators AND dead players */}
      <Show when={props.spectate || (props.playerId != null && !state().players?.[props.playerId]?.alive)}>
        <div class="fixed top-4 left-4 z-30 flex flex-col gap-1">
          <div class="flex items-center gap-2 bg-yellow-800/80 text-white px-3 py-1.5 rounded text-sm font-bold">
            <span>{t("bomberman.spectating")}</span>
            <button
              type="button"
              class={`px-2 py-0.5 text-xs rounded ${
                spectatorMode() === "follow" ? "bg-yellow-600" : "bg-yellow-900/60"
              }`}
              onClick={() => {
                if (spectatorMode() === "follow") {
                  setSpectatorMode("overview");
                  setFollowTarget(null);
                } else {
                  cycleFollowTarget();
                }
              }}
            >
              {spectatorMode() === "follow" ? t("bomberman.spectateFollow") : t("bomberman.spectateOverview")}
            </button>
            <Show when={props.onLeaveSpectate}>
              <Button
                size="xs"
                variant="ghost"
                class="text-white ml-1 border border-white/30"
                onClick={props.onLeaveSpectate}
              >
                {t("bomberman.leaveSpectate")}
              </Button>
            </Show>
          </div>
        </div>
      </Show>

      <Button
        size="sm"
        variant="ghost"
        circle
        class="fixed top-4 right-20 z-30 text-white"
        onClick={() => {
          if (controlsAutoHidden()) {
            setShowControls(true);
          } else {
            setShowControls(!showControls());
          }
        }}
      >
        ?
      </Button>
      {/* Menu/surrender button — opens menu overlay for alive players */}
      <Show when={!props.spectate && props.playerId && state().players[props.playerId]?.alive}>
        <Button
          size="sm"
          variant="error"
          outline
          class="fixed top-4 right-4 z-30"
          onClick={() => setShowMenuOverlay(true)}
        >
          {t("bomberman.surrender")}
        </Button>
      </Show>
      {/* No-pause menu overlay — local only, game continues */}
      <Show when={showMenuOverlay()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="bg-base-200 p-6 rounded-lg text-center max-w-sm mx-4">
            <h2 class="text-lg font-bold text-white mb-3">{t("bomberman.menu")}</h2>
            <p class="text-sm text-white/80 mb-5">{t("bomberman.noPauseMessage")}</p>
            <div class="flex flex-col gap-3">
              <Button outline onClick={() => setShowMenuOverlay(false)}>
                {t("bomberman.menuBackToGame")}
              </Button>
              <Show when={!props.spectate && props.playerId && state().players[props.playerId]?.alive}>
                <Button variant="error" outline onClick={() => setShowSurrenderConfirm(true)}>
                  {t("bomberman.surrender")}
                </Button>
              </Show>
              <Show when={props.spectate && !!props.onLeaveSpectate}>
                <Button outline onClick={props.onLeaveSpectate}>
                  {t("bomberman.leaveSpectate")}
                </Button>
              </Show>
              <Show when={!props.spectate}>
                <Button outline onClick={props.onBackToRoom}>
                  {t("bomberman.leaveRoom")}
                </Button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
      {/* Surrender confirm sub-dialog — layered over menu overlay */}
      <Show when={!props.spectate && showSurrenderConfirm()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div class="bg-base-200 p-6 rounded-lg text-center">
            <p class="mb-4">{t("bomberman.areYouSure")}</p>
            <div class="flex gap-3 justify-center">
              <Button outline onClick={() => setShowSurrenderConfirm(false)}>
                {t("bomberman.cancel")}
              </Button>
              <Button
                variant="error"
                onClick={() => {
                  session.onAction({ type: "SURRENDER" });
                  setShowSurrenderConfirm(false);
                  setShowMenuOverlay(false);
                }}
              >
                {t("bomberman.yesSurrender")}
              </Button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={props.displaced?.()}>
        <TakeoverOverlay scope="Game" dim={70} />
      </Show>
      <Show when={props.chatDomain && props.playerId}>
        <div class="fixed bottom-4 right-4 z-50">
          <Show when={!gameChatVisible()}>
            <Button variant="primary" class="shadow-lg btn-circle" onClick={() => setGameChatVisible(true)}>
              💬
            </Button>
          </Show>
          <Show when={gameChatVisible()}>
            <div class="w-96 bg-base-100/80 backdrop-blur-sm shadow-xl pixel-border">
              <div class="flex justify-between p-2 border-b border-base-300">
                <span class="text-sm font-medium">{t("Chat")}</span>
                <Button size="xs" variant="ghost" onClick={() => setGameChatVisible(false)}>
                  ✕
                </Button>
              </div>
              <div class="p-2">
                <ChatPanel
                  domain={props.chatDomain ?? ""}
                  userId={props.playerId ?? ""}
                  quickMessageKeys={["help", "danger", "nice", "follow_me"]}
                  scopes={props.spectate ? ["game", "room"] : ["game", "team"]}
                  transparent
                />
              </div>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
