import { Application } from "solid-pixi";
import { createSignal, createMemo, createEffect, onMount, onCleanup, Show } from "solid-js";
import type { BombermanState, BombermanOperation } from "@generale/types";
import { GameStatus, bombermanSettingsSchema } from "@generale/types";
import { useBombermanInput } from "./hooks/useBombermanInput";
import { useGameSettings } from "~/hooks/useGameSettings";
import { MapLayer } from "./components/MapLayer";
import { EntityLayer } from "./components/EntityLayer";
import { HUD } from "./components/HUD";
import { VirtualControls } from "./components/VirtualControls";
import { Scoreboard } from "./components/Scoreboard";
import { Countdown } from "~/ui/Countdown";
import { sfx } from "~/ui/sound";
import { formatKey } from "./utils";
import { useT } from "~/i18n/useT";
import { Button } from "~/ui";

interface BombermanGameProps {
  initialState: BombermanState;
  onAction: (op: BombermanOperation) => void;
  onBackToRoom: () => void;
  playerId?: string;
}

export function BombermanGame(props: BombermanGameProps) {
  const { t } = useT();
  const { showVirtualControls } = useBombermanInput(props.onAction);
  const { settings: gameSettings } = useGameSettings(bombermanSettingsSchema);
  const [showScoreboard, setShowScoreboard] = createSignal(false);
  const [rankings, setRankings] = createSignal<{ name: string; rank: number }[]>([]);
  const [showControls, setShowControls] = createSignal(true);
  const [connectionOk, setConnectionOk] = createSignal(true);
  const [showSurrenderConfirm, setShowSurrenderConfirm] = createSignal(false);
  const [controlsAutoHidden, setControlsAutoHidden] = createSignal(false);

  const state = createMemo(() => props.initialState);

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
    setGameScale(Math.max(1, Math.min(scaleW, scaleH, 3)));
  }
  onMount(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
  });
  onCleanup(() => window.removeEventListener("resize", calculateScale));
  createEffect(() => {
    if (state()?.map?.tiles) calculateScale();
  });

  // ── Countdown ──
  const [countdownDone, setCountdownDone] = createSignal(false);

  // ── Sound effects ──
  let prevBombCount = 0;
  let prevExplosionCount = 0;
  let prevAliveCount = 0;
  let prevItemsCount = 0;
  let gameEnded = false;

  createEffect(() => {
    const s = state();
    if (!s) return;

    // Bomb placed
    const bombCount = s.bombs?.length ?? 0;
    if (bombCount > prevBombCount) {
      sfx.bombPlace();
    }
    prevBombCount = bombCount;

    // Explosion
    const explosionCount = s.explosions?.length ?? 0;
    if (explosionCount > prevExplosionCount) {
      sfx.explosion();
    }
    prevExplosionCount = explosionCount;

    // Item picked up (items count decreased)
    const itemsCount = s.items?.length ?? 0;
    if (itemsCount < prevItemsCount) {
      sfx.pickup();
    }
    prevItemsCount = itemsCount;

    // Player died
    const aliveCount = Object.values(s.players ?? {}).filter((p) => p.alive).length;
    if (aliveCount < prevAliveCount && prevAliveCount > 0) {
      sfx.death();
    }
    prevAliveCount = aliveCount;

    // Game ended
    if (s.status === GameStatus.Ended && !gameEnded) {
      gameEnded = true;
      const myPlayer = props.playerId ? s.players?.[props.playerId] : null;
      if (myPlayer?.alive) {
        sfx.victory();
      } else {
        sfx.defeat();
      }
    }
  });

  onMount(() => {
    setTimeout(() => {
      setShowControls(false);
      setControlsAutoHidden(true);
    }, 6000);
  });

  // Tick-health monitor: starts after countdown, warns if no tick for >3s
  let lastTick = Date.now();
  let monitorTimer: ReturnType<typeof setInterval> | null = null;
  createEffect(() => {
    if (!countdownDone()) return;
    if (monitorTimer) return; // already running
    lastTick = Date.now();
    monitorTimer = setInterval(() => {
      const s = state();
      const currentTick = s?.tick ?? -1;
      const now = Date.now();
      if (currentTick > 0) lastTick = now;
      setConnectionOk(now - lastTick < 3000);
    }, 500);
  });
  onCleanup(() => {
    if (monitorTimer) clearInterval(monitorTimer);
  });

  createMemo(() => {
    const s = state();
    if (!s?.players) return;
    if (s.status === GameStatus.Ended) {
      const allPlayers = Object.values(s.players) as { playerId: string; name: string; alive: boolean }[];
      const list = allPlayers
        .sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? -1 : 1))
        .map((p, i) => ({ name: p.name ?? p.playerId.slice(0, 8), rank: i + 1 }));
      setRankings(list);
      setShowScoreboard(true);
    }
  });

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
        <Application resizeTo={window} resolution={window.devicePixelRatio} autoDensity>
          <MapLayer tiles={state().map?.tiles ?? []} />
          <EntityLayer
            players={players()}
            bombs={state().bombs ?? []}
            explosions={state().explosions ?? []}
            items={state().items ?? []}
          />
        </Application>
      </div>

      <HUD
        timeLeft={state().roundTimer ?? 0}
        aliveCount={players().filter((p) => p.alive).length}
        totalPlayers={players().length}
        playerStats={myStats()}
        playerItems={myItems()}
      />

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
              {formatKey(gameSettings().keybindings.up)}/{formatKey(gameSettings().keybindings.down)}/{formatKey(gameSettings().keybindings.left)}/{formatKey(gameSettings().keybindings.right)}
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
      <Show when={showVirtualControls()}>
        <VirtualControls onAction={props.onAction} />
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
      <Show when={props.playerId && state().players[props.playerId]?.alive}>
        <Button
          size="sm"
          variant="error"
          outline
          class="fixed top-4 right-4 z-30"
          onClick={() => setShowSurrenderConfirm(true)}
        >
          {t("bomberman.surrender")}
        </Button>
        <Show when={showSurrenderConfirm()}>
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
                    props.onAction({ type: "SURRENDER" });
                    setShowSurrenderConfirm(false);
                  }}
                >
                  {t("bomberman.yesSurrender")}
                </Button>
              </div>
            </div>
          </div>
        </Show>
      </Show>
      <Show when={showScoreboard()}>
        <Scoreboard players={rankings()} onBackToRoom={props.onBackToRoom} />
      </Show>
    </div>
  );
}
