import type { BombermanPlayer, Bomb, Explosion, Item } from "@generale/types";
import { For, Show } from "solid-js";

const TILE_SIZE = 36;
const PLAYER_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12"];

const ITEM_COLORS: Record<string, string> = {
  BOMB_UP: "#f44",
  FIRE_UP: "#f80",
  SPEED_UP: "#4af",
  KICK: "#a6f",
  GLOVE: "#ccc",
  PUNCH: "#fa0",
  REMOTE: "#0ff",
  PIERCE: "#fff",
  SPIRIT: "#f0f",
};

interface EntityLayerProps {
  players: BombermanPlayer[];
  bombs: Bomb[];
  explosions: Explosion[];
  items: Item[];
}

export function EntityLayer(props: EntityLayerProps) {
  return (
    <div class="pointer-events-none">
      <For each={props.players}>
        {(player, i) => (
          <Show when={player.alive}>
            <div
              class="absolute rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{
                width: `${TILE_SIZE * 0.6}px`,
                height: `${TILE_SIZE * 0.6}px`,
                background: PLAYER_COLORS[i() % PLAYER_COLORS.length],
                left: `${player.x * TILE_SIZE + TILE_SIZE * 0.2}px`,
                top: `${player.y * TILE_SIZE + TILE_SIZE * 0.2}px`,
                border: "2px solid rgba(255,255,255,0.5)",
                "box-shadow": "0 0 6px rgba(0,0,0,0.5)",
                transition: "left 0.08s linear, top 0.08s linear",
              }}
            >
              {player.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
          </Show>
        )}
      </For>

      <For each={props.bombs}>
        {(bomb) => (
          <div
            class="absolute rounded-full flex items-center justify-center font-bold text-white text-xs"
            style={{
              width: `${TILE_SIZE * 0.5}px`,
              height: `${TILE_SIZE * 0.5}px`,
              left: `${bomb.x * TILE_SIZE + TILE_SIZE * 0.25}px`,
              top: `${bomb.y * TILE_SIZE + TILE_SIZE * 0.25}px`,
              background: bomb.fuse % 2 === 0 ? "#222" : "#e00",
              border: "1px solid #fff",
              "box-shadow": bomb.fuse <= 3 ? "0 0 8px #f00" : "0 0 2px rgba(0,0,0,0.5)",
            }}
          >
            B
          </div>
        )}
      </For>

      <For each={props.explosions}>
        {(exp) => (
          <div
            class="absolute rounded-sm"
            style={{
              width: `${TILE_SIZE}px`,
              height: `${TILE_SIZE}px`,
              left: `${exp.x * TILE_SIZE}px`,
              top: `${exp.y * TILE_SIZE}px`,
              background: `rgba(255,120,0,${exp.ttl / 8})`,
              "box-shadow": "inset 0 0 8px #ff0",
            }}
          />
        )}
      </For>

      <For each={props.items}>
        {(item) => (
          <div
            class="absolute flex items-center justify-center text-xs font-bold"
            style={{
              width: `${TILE_SIZE * 0.4}px`,
              height: `${TILE_SIZE * 0.4}px`,
              left: `${item.x * TILE_SIZE + TILE_SIZE * 0.3}px`,
              top: `${item.y * TILE_SIZE + TILE_SIZE * 0.3}px`,
              background: ITEM_COLORS[item.type] ?? "#ff0",
              border: "1px solid #fff",
              "border-radius": "3px",
              "box-shadow": "0 0 4px rgba(255,255,255,0.3)",
            }}
          >
            {item.type === "BOMB_UP"
              ? "B+"
              : item.type === "FIRE_UP"
                ? "F+"
                : item.type === "SPEED_UP"
                  ? "S+"
                  : (item.type?.charAt(0) ?? "?")}
          </div>
        )}
      </For>
    </div>
  );
}
