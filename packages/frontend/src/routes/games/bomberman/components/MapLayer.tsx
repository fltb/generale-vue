import type { BombermanTile } from "@generale/types";
import { For } from "solid-js";

const TILE_SIZE = 36;

interface MapLayerProps {
  tiles: BombermanTile[][];
}

export function MapLayer(props: MapLayerProps) {
  return (
    <div
      class="grid"
      style={{
        display: "grid",
        "grid-template-columns": `repeat(${props.tiles[0]?.length ?? 0}, ${TILE_SIZE}px)`,
      }}
    >
      <For each={props.tiles}>
        {(row, y) => (
          <For each={row}>
            {(tile, x) => {
              const idx = y() + x();
              const isEven = idx % 2 === 0;
              if (tile.type === "hard_wall") {
                return (
                  <div
                    style={{
                      width: `${TILE_SIZE}px`,
                      height: `${TILE_SIZE}px`,
                      background: `linear-gradient(135deg, #555 0%, #3a3a3a 50%, #555 100%)`,
                      border: "1px solid #222",
                      "box-shadow": "inset 0 0 4px rgba(0,0,0,0.5)",
                    }}
                  />
                );
              }
              if (tile.type === "soft_wall") {
                return (
                  <div
                    style={{
                      width: `${TILE_SIZE}px`,
                      height: `${TILE_SIZE}px`,
                      background: `linear-gradient(135deg, #b8956a 0%, #a0784c 50%, #b8956a 100%)`,
                      border: "1px solid #8b6914",
                      "box-shadow": "inset 0 0 3px rgba(0,0,0,0.3), inset 0 0 8px rgba(255,255,255,0.1)",
                    }}
                  />
                );
              }
              return (
                <div
                  style={{
                    width: `${TILE_SIZE}px`,
                    height: `${TILE_SIZE}px`,
                    background: isEven ? "#2d5a1e" : "#255016",
                    border: "0.5px solid #1a3a0e",
                  }}
                />
              );
            }}
          </For>
        )}
      </For>
    </div>
  );
}
