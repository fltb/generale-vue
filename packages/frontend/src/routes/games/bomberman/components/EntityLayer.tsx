import type { BombermanPlayer, Bomb, Explosion, Item } from "@generale/types";
import * as PIXI from "pixi.js";
import { createEffect, createSignal } from "solid-js";
import { Container, Graphics as PGraphics } from "solid-pixi";
import {
  drawBomb,
  drawExplosion,
  drawItem,
  drawPlayer,
  PLAYER_COLORS,
} from "../sprites/procedural";

interface EntityLayerProps {
  players: BombermanPlayer[];
  bombs: Bomb[];
  explosions: Explosion[];
  items: Item[];
}

export function EntityLayer(props: EntityLayerProps) {
  const [playersG, setPlayersG] = createSignal<PIXI.Graphics | undefined>(undefined);
  const [bombsG, setBombsG] = createSignal<PIXI.Graphics | undefined>(undefined);
  const [explosionsG, setExplosionsG] = createSignal<PIXI.Graphics | undefined>(undefined);
  const [itemsG, setItemsG] = createSignal<PIXI.Graphics | undefined>(undefined);
  let pulseTick = 0;

  // ── Pulse counter for bomb animation ──
  createEffect(() => {
    const s = bombsG();
    if (!s) return;
    // Advance pulse on each re-render
    pulseTick = (pulseTick + 1) % 100;
  });

  // ── Players ──
  createEffect(() => {
    const graphics = playersG();
    if (!graphics) return;
    graphics.clear();

    const players = props.players;
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (!player || !player.alive) continue;
      const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
      drawPlayer(graphics, player.x, player.y, color, player.facing, player.name);
    }
  });

  // ── Bombs ──
  createEffect(() => {
    const graphics = bombsG();
    if (!graphics) return;
    graphics.clear();

    const bombs = props.bombs;
    for (let i = 0; i < bombs.length; i++) {
      const bomb = bombs[i];
      if (!bomb) continue;
      drawBomb(graphics, bomb.x, bomb.y, bomb.fuse, pulseTick + i);
    }
  });

  // ── Explosions ──
  createEffect(() => {
    const graphics = explosionsG();
    if (!graphics) return;
    graphics.clear();

    const explosions = props.explosions;
    for (let i = 0; i < explosions.length; i++) {
      const exp = explosions[i];
      if (!exp) continue;
      drawExplosion(graphics, exp.x, exp.y, exp.ttl);
    }
  });

  // ── Items ──
  createEffect(() => {
    const graphics = itemsG();
    if (!graphics) return;
    graphics.clear();

    const items = props.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      drawItem(graphics, item.x, item.y, item.type);
    }
  });

  return (
    <Container>
      {/* Items (bottom-most among entities) */}
      <PGraphics
        ref={(inst) => {
          setItemsG(inst);
          return () => setItemsG(undefined);
        }}
      />
      {/* Bombs */}
      <PGraphics
        ref={(inst) => {
          setBombsG(inst);
          return () => setBombsG(undefined);
        }}
      />
      {/* Explosions */}
      <PGraphics
        ref={(inst) => {
          setExplosionsG(inst);
          return () => setExplosionsG(undefined);
        }}
      />
      {/* Players (top-most) */}
      <PGraphics
        ref={(inst) => {
          setPlayersG(inst);
          return () => setPlayersG(undefined);
        }}
      />
    </Container>
  );
}
