import { Application } from "solid-pixi";
import { createSignal, createMemo } from "solid-js";
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
}

export function BombermanGame(props: BombermanGameProps) {
  const { showVirtualControls } = useBombermanInput(props.onAction);
  const [showScoreboard, setShowScoreboard] = createSignal(false);
  const [rankings, setRankings] = createSignal<{ name: string; rank: number; score: number }[]>([]);

  const state = createMemo(() => props.initialState);

  createMemo(() => {
    const s = state();
    if (!s?.players) return;
    if (s.status === GameStatus.Ended) {
      const allPlayers = Object.values(s.players) as { playerId: string; alive: boolean }[];
      const list = allPlayers
        .sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? -1 : 1))
        .map((p, i) => ({ name: p.playerId.slice(0, 8), rank: i + 1, score: p.alive ? 100 : 0 }));
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
      {showVirtualControls() && <VirtualControls onAction={props.onAction} />}
      {showScoreboard() && <Scoreboard players={rankings()} onBackToRoom={props.onBackToRoom} />}
    </div>
  );
}
