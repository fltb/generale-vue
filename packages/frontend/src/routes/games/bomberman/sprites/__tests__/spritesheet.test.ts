import { describe, expect, it } from "vitest";
import { ALL_PLAYER_FRAMES } from "../spritesheet";

describe("player upward frames", () => {
  it("uses the player sprites rather than the effects-strip tiles", () => {
    // Order matches BOMBERMAN_SKIN_MANIFEST frameIndex: blue(p2), green(p0), red(p1), purple(p3).
    expect(ALL_PLAYER_FRAMES.map((frames) => frames.idleUp)).toEqual([
      { x: 96, y: 240, w: 16, h: 16 },
      { x: 96, y: 224, w: 16, h: 16 },
      { x: 96, y: 272, w: 16, h: 16 },
      { x: 96, y: 256, w: 16, h: 16 },
    ]);
  });
});

import { ITEM_FRAMES, FRAME, COLS } from "../spritesheet";

describe("item frames", () => {
  const ITEM_TYPES = ["BOMB_UP", "FIRE_UP", "SPEED_UP", "KICK", "GLOVE", "PUNCH", "REMOTE", "PIERCE", "SPIRIT"] as const;
  const ROW_20_Y = 20 * FRAME;

  it("maps every item type to a tile in the item row (row 20)", () => {
    for (const type of ITEM_TYPES) {
      const frame = ITEM_FRAMES[type];
      expect(frame).toBeDefined();
      expect(frame.y).toBe(ROW_20_Y);
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.x).toBeLessThan(COLS * FRAME);
    }
  });

  it("each item frame has the correct 16x16 dimensions", () => {
    for (const type of ITEM_TYPES) {
      const frame = ITEM_FRAMES[type];
      expect(frame.w).toBe(FRAME);
      expect(frame.h).toBe(FRAME);
    }
  });

  it("covers all 9 defined ItemType values", () => {
    expect(Object.keys(ITEM_FRAMES)).toEqual(ITEM_TYPES);
  });
});
