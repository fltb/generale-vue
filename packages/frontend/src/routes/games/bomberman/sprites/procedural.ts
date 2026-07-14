import { Graphics } from "pixi.js";

export const TILE_SIZE = 48;

// Colors
const COLORS = {
  floor1: 0x4a8c3f, // grass green
  floor2: 0x3d7a33, // darker grass
  hardWall: 0x666666, // gray stone
  hardWallTop: 0x888888,
  softWall: 0x8b6914, // brown crate
  softWallLine: 0x6b4f10,
  explosion1: 0xff6600,
  explosion2: 0xffcc00,
  bombBody: 0x222222,
  bombFuse: 0xff0000,
  itemBg: 0x222222,
};

// Player colors
export const PLAYER_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12];

// Item colors
const ITEM_COLORS: Record<string, number> = {
  BOMB_UP: 0xcc4400,
  FIRE_UP: 0xff8800,
  SPEED_UP: 0x0088cc,
  KICK: 0x884400,
  GLOVE: 0xccaa00,
  PUNCH: 0xcc0000,
  REMOTE: 0x8800cc,
  PIERCE: 0xffcc00,
  SPIRIT: 0x44cc44,
};

// ─── Floor tile ───
export function drawFloor(g: Graphics, x: number, y: number, variant: number): void {
  g.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill({
    color: variant % 2 === 0 ? COLORS.floor1 : COLORS.floor2,
  });
}

// ─── Hard wall (indestructible) ───
export function drawHardWall(g: Graphics, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  // Main body
  g.roundRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4, 4).fill({ color: COLORS.hardWall });
  // Top highlight
  g.roundRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE / 2 - 4, 3).fill({
    color: COLORS.hardWallTop,
    alpha: 0.3,
  });
}

// ─── Soft wall (destructible crate) ───
export function drawSoftWall(g: Graphics, x: number, y: number): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  // Crate body
  g.rect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6).fill({ color: COLORS.softWall });
  // Cross planks
  g.moveTo(px + 3, py + 3).lineTo(px + TILE_SIZE - 3, py + TILE_SIZE - 3).stroke({
    color: COLORS.softWallLine,
    width: 2,
  });
  g.moveTo(px + TILE_SIZE - 3, py + 3).lineTo(px + 3, py + TILE_SIZE - 3).stroke({
    color: COLORS.softWallLine,
    width: 2,
  });
  // Border
  g.roundRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6, 2).stroke({
    color: COLORS.softWallLine,
    width: 1.5,
  });
}

// ─── Player (colored circle with face) ───
export function drawPlayer(
  g: Graphics,
  x: number,
  y: number,
  color: number,
  _facing: string,
  name: string,
): void {
  const cx = x * TILE_SIZE + TILE_SIZE / 2;
  const cy = y * TILE_SIZE + TILE_SIZE / 2;
  const r = TILE_SIZE * 0.35;
  // Body
  g.circle(cx, cy, r).fill({ color, alpha: 0.9 });
  g.circle(cx, cy, r).stroke({ color: 0x000000, width: 1.5 });
  // Eyes (small dots)
  const eyeOff = 5;
  const eyeR = 3;
  const eyeY = cy - 4;
  g.circle(cx - eyeOff, eyeY, eyeR).fill({ color: 0x000000 });
  g.circle(cx + eyeOff, eyeY, eyeR).fill({ color: 0x000000 });
  // Name initial
  if (name) {
    // We draw a small label for the initial — using a white dot as placeholder
    // since PixiJS Text objects aren't available in Graphics draw
    g.circle(cx, cy + 8, 2).fill({ color: 0xffffff });
  }
}

// ─── Bomb ───
export function drawBomb(g: Graphics, x: number, y: number, fuse: number, pulse: number): void {
  const cx = x * TILE_SIZE + TILE_SIZE / 2;
  const cy = y * TILE_SIZE + TILE_SIZE / 2;
  const r = TILE_SIZE * 0.25;
  const pulseScale = 1 + (pulse % 2 === 0 ? 0.05 : 0);
  // Body
  g.circle(cx, cy, r * pulseScale).fill({ color: COLORS.bombBody });
  g.circle(cx, cy, r * pulseScale).stroke({ color: 0x444444, width: 1.5 });
  // Fuse spark
  if (fuse <= 3) {
    g.circle(cx, cy - r * pulseScale - 4, 3).fill({
      color: fuse % 2 === 0 ? COLORS.bombFuse : 0xff8800,
    });
  }
}

// ─── Explosion tile ───
export function drawExplosion(g: Graphics, x: number, y: number, ttl: number): void {
  const alpha = Math.max(0.2, ttl / 8);
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  g.roundRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4, 6).fill({
    color: ttl > 3 ? COLORS.explosion1 : COLORS.explosion2,
    alpha,
  });
}

// ─── Item ───
export function drawItem(g: Graphics, x: number, y: number, type: string): void {
  const cx = x * TILE_SIZE + TILE_SIZE / 2;
  const cy = y * TILE_SIZE + TILE_SIZE / 2;
  const s = TILE_SIZE * 0.3;
  // Background square
  const itemColor = ITEM_COLORS[type] ?? 0x888888;
  g.roundRect(cx - s, cy - s, s * 2, s * 2, 4).fill({ color: itemColor });
  g.roundRect(cx - s, cy - s, s * 2, s * 2, 4).stroke({ color: 0x000000, width: 1 });
  // First letter indicator — small dot
  g.circle(cx, cy, 3).fill({ color: 0xffffff, alpha: 0.8 });
}
