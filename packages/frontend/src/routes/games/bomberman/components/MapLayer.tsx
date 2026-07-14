import type { BombermanTile } from "@generale/types";
import * as PIXI from "pixi.js";
import { createEffect, createSignal } from "solid-js";
import { Graphics as PGraphics } from "solid-pixi";
import { drawFloor, drawHardWall, drawSoftWall } from "../sprites/procedural";

interface MapLayerProps {
  tiles: BombermanTile[][];
}

export function MapLayer(props: MapLayerProps) {
  const [g, setG] = createSignal<PIXI.Graphics | undefined>(undefined);

  createEffect(() => {
    const graphics = g();
    if (!graphics) return;

    const tiles = props.tiles;
    graphics.clear();

    for (let y = 0; y < tiles.length; y++) {
      const row = tiles[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x++) {
        const tile = row[x];
        if (!tile) continue;
        switch (tile.type) {
          case "empty":
            drawFloor(graphics, x, y, x + y);
            break;
          case "hard_wall":
            drawFloor(graphics, x, y, x + y);
            drawHardWall(graphics, x, y);
            break;
          case "soft_wall":
            drawFloor(graphics, x, y, x + y);
            drawSoftWall(graphics, x, y);
            break;
        }
      }
    }
  });

  return (
    <PGraphics
      ref={(inst) => {
        setG(inst);
        return () => setG(undefined);
      }}
    />
  );
}
