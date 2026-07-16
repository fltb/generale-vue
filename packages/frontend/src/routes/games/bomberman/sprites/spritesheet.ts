/**
 * Frame definitions for bomberman.png (240×336, 15 cols × 21 rows, 16×16 frames).
 * Coordinates sourced from dennis/bombermanjs Tiled map + sprites.json.
 *
 * Conversion: col = (tiledId - 1) % 15, row = floor((tiledId - 1) / 15)
 * pixelX = col * 16, pixelY = row * 16
 */

export interface FrameDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRAME = 16;
const COLS = 15;

/** Convert Tiled tile ID (1-based) to pixel frame coordinates */
function tid(id: number): FrameDef {
  const idx = id - 1;
  return { x: (idx % COLS) * FRAME, y: Math.floor(idx / COLS) * FRAME, w: FRAME, h: FRAME };
}

/** Display tile size in pixels (sprites upscaled from 16×16) */
export const TILE_SIZE = 36;

// ─── Player frame data (per-player, using Tiled IDs) ───
// Each player has: idle-down, walk-down(2), idle-right, walk-right(3),
// idle-up, walk-up(2), walk-left(3, mirror for right), idle-left.

export interface PlayerFrames {
  idleDown: FrameDef;
  walkDown: FrameDef[];
  idleRight: FrameDef;
  walkRight: FrameDef[];
  idleUp: FrameDef;
  walkUp: FrameDef[];
  walkLeft: FrameDef[]; // mirrored for right-facing rendering
  idleLeft: FrameDef;
}

/**
 * Player 0 (blue-ish): Row 13-19
 *   up=210, down=211, right=214, left=288
 *   walk-down: 212,213  walk-right: 215,216,217  walk-up: 218,219  walk-left: 285,286,287
 */
const p0: PlayerFrames = {
  idleDown: tid(211),
  walkDown: [tid(212), tid(213)],
  idleRight: tid(214),
  walkRight: [tid(215), tid(216), tid(217)],
  idleUp: tid(210),
  walkUp: [tid(218), tid(219)],
  walkLeft: [tid(285), tid(286), tid(287)],
  idleLeft: tid(288),
};

/**
 * Player 1 (green): Row 13-18
 *   up=255, down=256, right=259, left=202
 *   walk-down: 257,258  walk-right: 260,261,262  walk-up: 263,264  walk-left: 199,200,201
 */
const p1: PlayerFrames = {
  idleDown: tid(256),
  walkDown: [tid(257), tid(258)],
  idleRight: tid(259),
  walkRight: [tid(260), tid(261), tid(262)],
  idleUp: tid(255),
  walkUp: [tid(263), tid(264)],
  walkLeft: [tid(199), tid(200), tid(201)],
  idleLeft: tid(202),
};

/**
 * Player 2 (red): Row 14-19
 *   up=225, down=226, right=229, left=292
 *   walk-down: 227,228  walk-right: 230,231,232  walk-up: 233,234  walk-left: 289,290,291
 */
const p2: PlayerFrames = {
  idleDown: tid(226),
  walkDown: [tid(227), tid(228)],
  idleRight: tid(229),
  walkRight: [tid(230), tid(231), tid(232)],
  idleUp: tid(225),
  walkUp: [tid(233), tid(234)],
  walkLeft: [tid(289), tid(290), tid(291)],
  idleLeft: tid(292),
};

/**
 * Player 3 (purple): Row 15-19
 *   up=240, down=241, right=244(=walk-right0), left=296
 *   walk-down: 242,243  walk-right: 244,245,246  walk-up: 248,249  walk-left: 293,294,295
 */
const p3: PlayerFrames = {
  idleDown: tid(241),
  walkDown: [tid(242), tid(243)],
  idleRight: tid(244),
  walkRight: [tid(244), tid(245), tid(246)],
  idleUp: tid(240),
  walkUp: [tid(248), tid(249)],
  walkLeft: [tid(293), tid(294), tid(295)],
  idleLeft: tid(296),
};

export const ALL_PLAYER_FRAMES: PlayerFrames[] = [p0, p1, p2, p3];

// ─── Bomb frames (6 frames, row 18, cols 3-8) ───
export const BOMB_FRAMES: FrameDef[] = [tid(274), tid(275), tid(276), tid(277), tid(278), tid(279)];

// ─── Explosion frames ───
export const EXPLOSION_CENTER = tid(272); // (16, 288)
export const EXPLOSION_H_MID = tid(271); // (0, 288)
export const EXPLOSION_V_MID = tid(224); // (208, 224)
export const EXPLOSION_LEFT_END = tid(270); // (224, 272)
export const EXPLOSION_RIGHT_END = tid(273); // (32, 288)
export const EXPLOSION_UP_END = tid(209); // (208, 208)
export const EXPLOSION_DOWN_END = tid(239); // (208, 240)

/** All explosion textures, useful for cycle animation */
export const EXPLOSION_ALL = [
  EXPLOSION_CENTER,
  EXPLOSION_H_MID,
  EXPLOSION_V_MID,
  EXPLOSION_LEFT_END,
  EXPLOSION_RIGHT_END,
  EXPLOSION_UP_END,
  EXPLOSION_DOWN_END,
];

// ─── Tiles ───
export const SOFT_WALL = tid(205); // crate/box (col 9, row 13) — tid(204) is empty
export const HARD_WALL = tid(266); // wall/block (160, 272)
export const FLOOR_1 = tid(197); // grass/floor 1 (16, 208)
export const FLOOR_2 = tid(198); // grass/floor 2 (32, 208)

// ─── Items (custom 16×16 pixel art, row 20, cols 0–8) ───
export const ITEM_FRAMES: Record<string, FrameDef> = {
  BOMB_UP: tid(301), // row 20, col 0 — black bomb with lit fuse
  FIRE_UP: tid(302), // row 20, col 1 — orange/red flame
  SPEED_UP: tid(303), // row 20, col 2 — yellow lightning bolt
  KICK: tid(304), // row 20, col 3 — brown boot
  GLOVE: tid(305), // row 20, col 4 — red boxing glove
  PUNCH: tid(306), // row 20, col 5 — closed fist
  REMOTE: tid(307), // row 20, col 6 — gray remote with red button
  PIERCE: tid(308), // row 20, col 7 — upward arrowhead
  SPIRIT: tid(309), // row 20, col 8 — white ghost
};
