import { Application } from "solid-pixi";
import { createSignal, createMemo, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import { unwrap } from "solid-js/store";
import { useParams, useNavigate } from "@solidjs/router";
import { ProtectedRoute } from "~/components/ProtectedRoute";
import { useT } from "~/i18n/useT";
import { Button, Alert, Spinner, Select } from "~/ui";
import { bombermanSettingsSchema } from "@generale/types";
import { useGameSettings } from "~/hooks/useGameSettings";
import { fetchBombermanReplayDetail } from "./api/replays";
import { MapLayer } from "./components/MapLayer";
import { EntityLayer } from "./components/EntityLayer";
import { HUD } from "./components/HUD";
import { useQuery } from "@tanstack/solid-query";
import type { BombermanReplayRound, BombermanState, BombermanPlayer } from "@generale/types";
import type { BombermanReplayRound as EngineReplayRound } from "@generale/bomberman-engine";
import { BOMBERMAN_REPLAY_ENGINE_VERSION } from "@generale/types";
import { createBombermanReplaySession } from "@generale/bomberman-engine";
import type { BombermanReplaySession } from "@generale/bomberman-engine";

type PlaybackSpeed = 0.5 | 1 | 2;

export function BombermanReplayPlayer() {
  const { t } = useT();
  const params = useParams();
  const navigate = useNavigate();

  // ── Fetch replay data ──
  const replayId = () => params.id ?? "";
  const replayQuery = useQuery(() => ({
    queryKey: ["bomberman-replay", params.id] as const,
    queryFn: () => fetchBombermanReplayDetail(replayId()),
  }));

  // ── Version check ──
  const versionOk = createMemo(() => {
    const data = replayQuery.data;
    if (!data) return true;
    return data.engineVersion === BOMBERMAN_REPLAY_ENGINE_VERSION;
  });

  // ── Round selection ──
  const [selectedRoundIdx, setSelectedRoundIdx] = createSignal(0);
  const currentRound = createMemo<BombermanReplayRound | undefined>(() => {
    const data = replayQuery.data;
    if (!data || data.rounds.length === 0) return undefined;
    const idx = Math.min(selectedRoundIdx(), data.rounds.length - 1);
    return data.rounds[idx];
  });

  // ── Replay session ──
  const [session, setSession] = createSignal<BombermanReplaySession | null>(null);
  const [currentState, setCurrentState] = createSignal<BombermanState | null>(null);
  const [currentTick, setCurrentTick] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal<PlaybackSpeed>(1);
  const { settings: gameSettings } = useGameSettings(bombermanSettingsSchema);

  // Detect reduced motion preference
  const [reducedMotion, setReducedMotion] = createSignal(false);
  onMount(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    onCleanup(() => mq.removeEventListener("change", handler));
  });

  const totalTicks = createMemo(() => {
    const r = currentRound();
    if (!r) return 0;
    return r.frames.length;
  });

  // Create/rebuild session when round changes
  createEffect(() => {
    const r = currentRound();
    if (!r) return;
    // unwrap: solid-query wraps data in a store proxy, which the engine's
    // structuredClone cannot clone (DataCloneError).
    const newSession = createBombermanReplaySession(unwrap(r) as unknown as EngineReplayRound);
    setSession(newSession);
    setCurrentState(newSession.getState());
    setCurrentTick(newSession.getTick());
    setPlaying(false);
  });

  // ── Playback loop ──
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function stepOnce() {
    const s = session();
    if (!s) return;
    const tick = s.getTick();
    const total = totalTicks();
    if (tick >= total) {
      setPlaying(false);
      return;
    }
    const nextState = s.step();
    setCurrentState(nextState);
    setCurrentTick(s.getTick());
  }

  createEffect(() => {
    if (!playing()) {
      clearTimer();
      return;
    }
    const currentSpeed = speed();
    const interval = Math.max(50, Math.round(1000 / (10 * currentSpeed)));

    function tick() {
      stepOnce();
      const s = session();
      if (s && s.getTick() < totalTicks()) {
        timer = setTimeout(tick, interval);
      } else {
        setPlaying(false);
      }
    }

    clearTimer();
    timer = setTimeout(tick, interval);

    onCleanup(() => clearTimer());
  });

  // ── Seek ──
  function seekTo(tick: number) {
    const s = session();
    if (!s) return;
    const clamped = Math.max(0, Math.min(tick, totalTicks()));
    const state = s.seek(clamped);
    setCurrentState(state);
    setCurrentTick(s.getTick());
  }

  function togglePlay() {
    const s = session();
    if (!s) return;
    if (playing()) {
      setPlaying(false);
    } else {
      if (currentTick() >= totalTicks()) {
        seekTo(0);
      }
      setPlaying(true);
    }
  }

  // ── Derived state for rendering ──
  const state = currentState;
  const players = createMemo(() => {
    const s = state();
    if (!s?.players) return [] as BombermanPlayer[];
    return Object.values(s.players);
  });
  const mapTiles = createMemo(() => state()?.map?.tiles ?? []);
  const bombs = createMemo(() => state()?.bombs ?? []);
  const explosions = createMemo(() => state()?.explosions ?? []);
  const items = createMemo(() => state()?.items ?? []);
  const tickRate = createMemo(() => state()?.config?.tickRate ?? 10);

  // ── Player stats for HUD (first alive player as "focus") ──
  const focusPlayerId = createMemo(() => {
    const s = state();
    if (!s?.players) return undefined;
    const entries = Object.entries(s.players);
    if (entries.length === 0) return undefined;
    const alive = entries.find(([, p]) => p.alive);
    return (alive ?? entries[0])[0];
  });
  const focusPlayer = createMemo(() => {
    const pid = focusPlayerId();
    if (!pid) return undefined;
    const s = state();
    if (!s?.players) return undefined;
    return s.players[pid];
  });
  const focusStats = createMemo(() => {
    const p = focusPlayer();
    if (!p) return undefined;
    return { bombMax: p.bombMax, bombActive: p.bombActive, blastRadius: p.blastRadius, speed: p.speed };
  });
  const focusItems = createMemo(() => focusPlayer()?.items ?? []);

  // ── Round result label ──
  const roundResultLabel = createMemo(() => {
    const r = currentRound();
    if (!r?.result) return "";
    const res = r.result;
    if (!res.winner) return t("bomberman.draw");
    const name = res.winner.kind === "player" ? res.winner.id.slice(0, 8) : res.winner.id;
    return t("bomberman.replay.roundResult", { name });
  });

  // ── Match result ──
  const matchWinnerLabel = createMemo(() => {
    const data = replayQuery.data;
    if (!data?.result?.winner) return null;
    const w = data.result.winner;
    return w.kind === "player" ? w.id.slice(0, 8) : w.id;
  });

  // ── Scale ──
  const TILE_SIZE = 36;
  const [gameScale, setGameScale] = createSignal(1);
  function calculateScale() {
    const tiles = mapTiles();
    if (tiles.length === 0) return;
    const cols = tiles[0]?.length ?? 1;
    const rows = tiles.length;
    const scaleW = (window.innerWidth * 0.85) / (cols * TILE_SIZE);
    const scaleH = (window.innerHeight * 0.7) / (rows * TILE_SIZE);
    setGameScale(Math.max(0.4, Math.min(scaleW, scaleH, 3)));
  }
  onMount(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
  });
  onCleanup(() => {
    window.removeEventListener("resize", calculateScale);
    clearTimer();
  });
  createEffect(() => {
    if (mapTiles().length > 0) calculateScale();
  });

  // ── Format helpers ──
  const formatTime = (tick: number, rate: number) => {
    const sec = tick / rate;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ── Render ──
  return (
    <ProtectedRoute>
      <div class="w-full h-screen overflow-hidden bg-gray-900 flex flex-col">
        {/* Navigation bar */}
        <nav class="bg-base-100 border-b border-base-300 px-4 py-2 flex items-center justify-between shrink-0 z-10">
          <div class="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/bomberman/replays")}>
              &larr; {t("bomberman.replays")}
            </Button>
            <span class="text-base-content/30">|</span>
            <span class="text-sm font-medium">{t("bomberman.title")}</span>
          </div>
        </nav>

        {/* Loading / Error / Unavailable */}
        <Show when={replayQuery.isLoading}>
          <div class="flex-1 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        </Show>

        <Show when={replayQuery.isError}>
          <div class="flex-1 flex items-center justify-center p-8">
            <Alert variant="error" class="max-w-md">
              {replayQuery.error?.toString() ?? t("bomberman.replay.loadError")}
            </Alert>
          </div>
        </Show>

        <Show when={replayQuery.isSuccess && !replayQuery.data}>
          <div class="flex-1 flex items-center justify-center p-8">
            <Alert variant="warning" class="max-w-md">
              {t("bomberman.replay.notFound")}
            </Alert>
          </div>
        </Show>

        <Show when={replayQuery.data && !versionOk()}>
          <div class="flex-1 flex items-center justify-center p-8">
            <Alert variant="warning" class="max-w-md">
              <p class="font-bold mb-2">{t("bomberman.replay.versionMismatch")}</p>
              <p class="text-sm">{t("bomberman.replay.versionDetail")}</p>
            </Alert>
          </div>
        </Show>

        {/* Main replay UI */}
        <Show when={replayQuery.data && versionOk() && currentRound()}>
          <div class="flex-1 relative overflow-hidden flex items-center justify-center">
            <div style={{ transform: `scale(${gameScale()})`, "transform-origin": "center" }}>
              <Show when={mapTiles().length > 0}>
                <Application
                  width={(mapTiles()[0]?.length ?? 1) * TILE_SIZE}
                  height={mapTiles().length * TILE_SIZE}
                  resolution={window.devicePixelRatio}
                  autoDensity
                >
                  <MapLayer tiles={mapTiles()} />
                  <EntityLayer
                    players={players()}
                    bombs={bombs()}
                    explosions={explosions()}
                    items={items()}
                    tickRate={tickRate()}
                    reducedMotion={reducedMotion()}
                    highContrast={gameSettings().highContrast}
                    colorVision={gameSettings().colorVision}
                  />
                </Application>
              </Show>
            </div>

            {/* Round info overlay */}
            <div class="absolute top-4 left-4 z-10 flex flex-col gap-1">
              <div class="bg-black/60 text-white px-3 py-1.5 rounded text-sm">
                <Show when={currentRound()}>
                  <span class="font-medium">
                    {t("bomberman.round_", { n: String(currentRound()?.roundNumber ?? 1 + selectedRoundIdx()) })}
                    <Show when={(currentRound()?.attempt ?? 1) > 1}>
                      <span class="text-yellow-400 ml-1">
                        ({t("bomberman.replay.attempt")} {currentRound()?.attempt})
                      </span>
                    </Show>
                  </span>
                  <span class="text-base-content/50 mx-2">|</span>
                  <span>{roundResultLabel()}</span>
                </Show>
              </div>
            </div>

            {/* Match info */}
            <Show when={replayQuery.data?.result}>
              <div class="absolute top-4 right-4 z-10">
                <div class="bg-black/60 text-white px-3 py-1.5 rounded text-sm">
                  <Show when={matchWinnerLabel()}>
                    {t("bomberman.matchChampion_", { name: matchWinnerLabel() ?? "" })}
                  </Show>
                  <Show when={!matchWinnerLabel()}>
                    <span>{t("bomberman.draw")}</span>
                  </Show>
                </div>
              </div>
            </Show>

            {/* HUD */}
            <div class="absolute top-16 left-0 right-0 z-10 pointer-events-none">
              <HUD
                timeLeft={state()?.roundTimer ?? 0}
                aliveCount={players().filter((p) => p.alive).length}
                totalPlayers={players().length}
                playerStats={focusStats()}
                playerItems={focusItems()}
              />
            </div>

            {/* Tick counter */}
            <div class="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-black/70 text-white px-3 py-1 rounded text-xs font-mono pointer-events-none">
              {t("bomberman.replay.tick")}: {currentTick()}/{totalTicks()} ({formatTime(currentTick(), tickRate())})
            </div>
          </div>

          {/* Playback controls bar */}
          <div class="bg-base-200 border-t border-base-300 px-4 py-3 flex items-center gap-3 shrink-0 z-10 flex-wrap">
            {/* Round selector */}
            <Show when={(replayQuery.data?.rounds.length ?? 0) > 1}>
              <div class="flex items-center gap-1">
                <span class="text-xs text-base-content/50 mr-1">{t("bomberman.round")}:</span>
                <Select
                  size="sm"
                  value={selectedRoundIdx()}
                  onChange={(e) => {
                    setPlaying(false);
                    setSelectedRoundIdx(Number(e.currentTarget.value));
                  }}
                >
                  <For each={replayQuery.data?.rounds ?? []}>
                    {(_, idx) => (
                      <option value={idx()}>
                        {t("bomberman.round_", { n: String(idx() + 1) })}
                        {(replayQuery.data?.rounds[idx()]?.attempt ?? 1) > 1
                          ? ` (${replayQuery.data?.rounds[idx()]?.attempt ?? 1})`
                          : ""}
                      </option>
                    )}
                  </For>
                </Select>
              </div>
            </Show>

            <div class="flex items-center gap-1">
              <Button
                size="xs"
                variant="ghost"
                disabled={currentTick() <= 0}
                onClick={() => {
                  setPlaying(false);
                  seekTo(0);
                }}
                aria-label={t("bomberman.replay.goToStart")}
              >
                &#8747;&#8212;
              </Button>
              <Button
                size="xs"
                variant="ghost"
                disabled={currentTick() <= 0}
                onClick={() => {
                  setPlaying(false);
                  seekTo(currentTick() - 1);
                }}
                aria-label={t("bomberman.replay.stepBack")}
              >
                &#9664;&#9664;
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={togglePlay}
                aria-label={playing() ? t("bomberman.replay.pause") : t("bomberman.replay.play")}
              >
                {playing() ? <span>&#10074;&#10074;</span> : <span>&#9654;</span>}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                disabled={currentTick() >= totalTicks()}
                onClick={() => {
                  setPlaying(false);
                  seekTo(currentTick() + 1);
                }}
                aria-label={t("bomberman.replay.stepForward")}
              >
                &#9654;&#9654;
              </Button>
              <Button
                size="xs"
                variant="ghost"
                disabled={currentTick() >= totalTicks()}
                onClick={() => {
                  setPlaying(false);
                  seekTo(totalTicks());
                }}
                aria-label={t("bomberman.replay.goToEnd")}
              >
                &#8747;&#8212;&#8212;
              </Button>
            </div>

            {/* Speed selector */}
            <div class="flex items-center gap-1">
              <span class="text-xs text-base-content/50">{t("bomberman.replay.speed")}:</span>
              <For each={[0.5, 1, 2] as PlaybackSpeed[]}>
                {(s) => (
                  <Button size="xs" variant={speed() === s ? "primary" : "ghost"} onClick={() => setSpeed(s)}>
                    {s}x
                  </Button>
                )}
              </For>
            </div>

            {/* Seek slider */}
            <div class="flex-1 min-w-[120px] flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={Math.max(1, totalTicks())}
                value={currentTick()}
                onInput={(e) => {
                  setPlaying(false);
                  seekTo(Number(e.currentTarget.value));
                }}
                class="w-full h-1.5 accent-primary cursor-pointer"
                aria-label={t("bomberman.replay.seek")}
              />
            </div>
          </div>
        </Show>
      </div>
    </ProtectedRoute>
  );
}
