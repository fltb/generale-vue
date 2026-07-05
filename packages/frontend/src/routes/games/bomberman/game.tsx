import { Application } from "solid-pixi";
import { createSignal, createMemo, onMount, onCleanup, Show } from "solid-js";
import type { BombermanState, BombermanOperation } from "@generale/types";
import { GameStatus } from "@generale/types";
import { useBombermanInput } from "./hooks/useBombermanInput";
import { MapLayer } from "./components/MapLayer";
import { EntityLayer } from "./components/EntityLayer";
import { HUD } from "./components/HUD";
import { VirtualControls } from "./components/VirtualControls";
import { Scoreboard } from "./components/Scoreboard";

interface BombermanGameProps {
  initialState: BombermanState;
  onAction: (op: BombermanOperation) => void;
  onBackToRoom: () => void;
  playerId?: string;
}

export function BombermanGame(props: BombermanGameProps) {
  const { showVirtualControls } = useBombermanInput(props.onAction);
  const [showScoreboard, setShowScoreboard] = createSignal(false);
  const [rankings, setRankings] = createSignal<{ name: string; rank: number; score: number }[]>([]);
  const [showControls, setShowControls] = createSignal(true);
  const [connectionOk, setConnectionOk] = createSignal(true);

  const state = createMemo(() => props.initialState);

  onMount(() => {
    setTimeout(() => setShowControls(false), 6000);
  });

  // Tick-health monitor: if state stops updating for >1500ms, show warning
  let lastTick = Date.now();
  let monitorTimer: ReturnType<typeof setInterval> | null = null;
  onMount(() => {
    monitorTimer = setInterval(() => {
      const s = state();
      const currentTick = s?.tick ?? -1;
      const now = Date.now();
      if (currentTick > 0) lastTick = now;
      setConnectionOk(now - lastTick < 1500);
    }, 500);
  });
  onCleanup(() => { if (monitorTimer) clearInterval(monitorTimer); });

  createMemo(() => {
    const s = state();
    if (!s?.players) return;
    if (s.status === GameStatus.Ended) {
      const allPlayers = Object.values(s.players) as { playerId: string; name: string; alive: boolean }[];
      const list = allPlayers
        .sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? -1 : 1))
        .map((p, i) => ({ name: p.name ?? p.playerId.slice(0, 8), rank: i + 1, score: p.alive ? 100 : 0 }));
      setRankings(list);
      setShowScoreboard(true);
    }
  });

  const players = createMemo(() => Object.values(state().players ?? {}));

  return (
    <div class="relative w-full h-screen overflow-hidden bg-gray-900">
      <div class="absolute inset-0" style="transform:scale(2);transform-origin:top left">
        <Application resizeTo={window}>
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
      />

      <Show when={!connectionOk()}>
        <div class="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-4 py-2 rounded z-40 text-sm font-bold pointer-events-none animate-pulse">
          Connection lost — reconnecting...
        </div>
      </Show>

      {showControls() && (
        <div class="fixed bottom-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-4 rounded-lg z-40 text-sm text-center pointer-events-none transition-opacity duration-500">
          <div class="font-bold mb-2">Controls</div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <span class="text-left">Move</span><span class="text-right font-mono">WASD / Arrows</span>
            <span class="text-left">Place Bomb</span><span class="text-right font-mono">Space</span>
            <span class="text-left">Detonate</span><span class="text-right font-mono">E</span>
          </div>
        </div>
      )}
      {showVirtualControls() && <VirtualControls onAction={props.onAction} />}
      {props.playerId && state().players[props.playerId]?.alive && (
        <button class="fixed top-4 right-4 z-30 btn btn-sm btn-outline btn-error" onClick={() => props.onAction({ type: "SURRENDER" } as BombermanOperation)}>
          Surrender
        </button>
      )}
      {showScoreboard() && <Scoreboard players={rankings()} onBackToRoom={props.onBackToRoom} />}
    </div>
  );
}
