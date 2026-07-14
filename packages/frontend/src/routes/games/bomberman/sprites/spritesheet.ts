/** Frame definition for a sub-texture in the spritesheet */
export interface FrameDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRAME = 16;

function frame(col: number, row: number): FrameDef {
  return { x: col * FRAME, y: row * FRAME, w: FRAME, h: FRAME };
}

/** Display tile size in pixels (sprites are upscaled from 16×16) */
export const TILE_SIZE = 36;

// ─── Player rows in spritesheet ───
export const PLAYER_ROWS = [14, 15, 16, 17]; // White, Black, Blue, Red

/** Direction → { stand: col index, frames: all frame cols } */
export const PLAYER_DIR_COLS: Record<string, { stand: number; frames: number[] }> = {
  down: { stand: 0, frames: [0, 8, 9] },
  left: { stand: 1, frames: [1, 2, 3] },
  up: { stand: 4, frames: [4, 5, 6, 7] },
  right: { stand: 1, frames: [1, 2, 3] }, // mirrored via scale.x = -1
};

// ─── Tile frames ───
export const HARD_WALL = frame(0, 12);
export const SOFT_WALL = frame(0, 13);
export const FLOOR_1 = frame(1, 13);
export const FLOOR_2 = frame(2, 13);

// ─── Bomb frames ───
export const BOMB_IDLE = frame(3, 13);
export const BOMB_ACTIVE = frame(9, 13);

// ─── Explosion frames (Row 18, cols 0-9) ───
export const EXPLOSION_FRAMES = Array.from({ length: 10 }, (_, i) => frame(i, 18));

// ─── Item frames ───
export const ITEM_FRAMES: Record<string, FrameDef> = {
  KICK: frame(11, 13),
  GLOVE: frame(12, 13),
  PIERCE: frame(13, 13),
  BOMB_UP: frame(14, 13), // fire icon repurposed as bomb-up
};
