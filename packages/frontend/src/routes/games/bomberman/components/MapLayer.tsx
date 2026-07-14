import type { BombermanTile } from "@generale/types";
import { For, Show } from "solid-js";
import { Container, Sprite } from "solid-pixi";
import { useSprites } from "../hooks/useSprites";
import { TILE_SIZE } from "../sprites/spritesheet";

interface MapLayerProps {
  tiles: BombermanTile[][];
}

export function MapLayer(props: MapLayerProps) {
  const sprites = useSprites();

  return (
    <Show when={sprites()}>
      {(s) => (
        <Container>
          <For each={props.tiles}>
            {(row, y) => (
              <For each={row}>
                {(tile, x) => {
                  const xi = x();
                  const yi = y();
                  const floorTex = s().floors[(xi + yi) % 2];
                  return (
                    <Container x={xi * TILE_SIZE} y={yi * TILE_SIZE}>
                      {/* Floor tile (always present) */}
                      <Sprite texture={floorTex} scale={{ x: TILE_SIZE / 16, y: TILE_SIZE / 16 }} />
                      {/* Wall overlay */}
                      <Show when={tile.type === "hard_wall"}>
                        <Sprite texture={s().walls.hard} scale={{ x: TILE_SIZE / 16, y: TILE_SIZE / 16 }} />
                      </Show>
                      <Show when={tile.type === "soft_wall"}>
                        <Sprite texture={s().walls.soft} scale={{ x: TILE_SIZE / 16, y: TILE_SIZE / 16 }} />
                      </Show>
                    </Container>
                  );
                }}
              </For>
            )}
          </For>
        </Container>
      )}
    </Show>
  );
}
