import { describe, it, expect } from "vitest";
import { validateBombermanMapDefinition } from "@generale/bomberman-engine";
import type { BombermanMapDefinition, BombermanTile, ItemType } from "@generale/types";

function makeEmptyMap(width: number, height: number): BombermanMapDefinition {
  return {
    schemaVersion: 1,
    width,
    height,
    themeId: "classic",
    tiles: Array.from({ length: height }, (): BombermanTile[] =>
      Array.from({ length: width }, (): BombermanTile => ({ type: "empty" })),
    ),
    spawns: [],
    fixedItems: [],
  };
}

/** Add soft walls to reach the validator's 35–70% density requirement. */
function addSoftWallDensity(map: BombermanMapDefinition, count: number) {
  let placed = 0;
  for (let y = 1; y < map.height - 1 && placed < count; y++) {
    for (let x = 1; x < map.width - 1 && placed < count; x++) {
      if (map.tiles[y]![x]!.type !== "empty") continue;
      map.tiles[y]![x] = { type: "soft_wall" };
      placed++;
    }
  }
}

describe("BombermanMapEditor — validateBombermanMapDefinition integration", () => {
  it("accepts a valid 15×13 map with valid soft wall density and 4 spawns", () => {
    const map = makeEmptyMap(15, 13);
    // Must place ~30 soft walls to reach 35% density in candidate area
    // Place them at positions that are NOT even-even and NOT in spawn safe-zones
    map.spawns = [
      { x: 1, y: 1 },
      { x: 13, y: 1 },
      { x: 1, y: 11 },
      { x: 13, y: 11 },
    ];
    // Place soft walls in rows 3-9, cols 3-11 (well outside spawn safe zones)
    for (let y = 3; y <= 9; y += 2) {
      for (let x = 3; x <= 11; x += 2) {
        if (y < map.tiles.length && x < (map.tiles[y]?.length ?? 0)) {
          map.tiles[y]![x] = { type: "soft_wall" };
        }
      }
    }
    // Place additional soft walls in remaining candidate positions
    for (let y = 2; y <= 10; y += 2) {
      for (let x = 3; x <= 11; x += 2) {
        if (y < map.tiles.length && x < (map.tiles[y]?.length ?? 0)) {
          map.tiles[y]![x] = { type: "soft_wall" };
        }
      }
    }
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_WALL_DENSITY")).toBe(false);
  });

  it("rejects even height", () => {
    const map = makeEmptyMap(15, 12);
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_DIMENSIONS")).toBe(true);
  });

  it("rejects width < 11", () => {
    const map = makeEmptyMap(9, 11);
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_DIMENSIONS")).toBe(true);
  });

  it("rejects width > 31", () => {
    const map = makeEmptyMap(33, 11);
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_DIMENSIONS")).toBe(true);
  });

  it("rejects invalid tile types", () => {
    const map = makeEmptyMap(15, 13);
    (map.tiles[0]![0] as unknown as { type: string }).type = "invalid_tile";
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_TILES")).toBe(true);
  });

  it("rejects too few spawns (< 2)", () => {
    const map = makeEmptyMap(15, 13);
    map.spawns = [{ x: 1, y: 1 }];
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_SPAWNS")).toBe(true);
  });

  it("rejects too many spawns (> 4)", () => {
    const map = makeEmptyMap(15, 13);
    map.spawns = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 5, y: 1 },
      { x: 7, y: 1 },
      { x: 9, y: 1 },
    ];
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_SPAWNS")).toBe(true);
  });

  it("rejects duplicate spawns", () => {
    const map = makeEmptyMap(15, 13);
    map.spawns = [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 7, y: 1 },
    ];
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_SPAWNS")).toBe(true);
  });

  it("rejects spawn on hard_wall (reported as INVALID_SPAWNS)", () => {
    const map = makeEmptyMap(15, 13);
    map.tiles[1]![1] = { type: "hard_wall" };
    map.spawns = [
      { x: 1, y: 1 },
      { x: 13, y: 1 },
      { x: 1, y: 11 },
      { x: 13, y: 11 },
    ];
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_SPAWNS")).toBe(true);
  });

  it("rejects spawn on soft_wall (reported as INVALID_SPAWNS)", () => {
    const map = makeEmptyMap(15, 13);
    map.tiles[1]![1] = { type: "soft_wall" };
    map.spawns = [
      { x: 1, y: 1 },
      { x: 13, y: 1 },
      { x: 1, y: 11 },
      { x: 13, y: 11 },
    ];
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_SPAWNS")).toBe(true);
  });

  it("shows validation issues live after editing — wall density error on empty map", () => {
    const map = makeEmptyMap(15, 13);
    map.spawns = [
      { x: 1, y: 1 },
      { x: 13, y: 1 },
      { x: 1, y: 11 },
      { x: 13, y: 11 },
    ];
    // Empty map fails INVALID_WALL_DENSITY
    const issues = validateBombermanMapDefinition(map);
    expect(issues.some((i) => i.code === "INVALID_WALL_DENSITY")).toBe(true);

    // Fix by placing enough soft walls outside safe-zone and not on even-even
    for (let y = 3; y <= 9; y += 2) {
      for (let x = 3; x <= 11; x += 2) {
        map.tiles[y]![x] = { type: "soft_wall" };
      }
    }
    for (let y = 2; y <= 10; y += 2) {
      for (let x = 3; x <= 11; x += 2) {
        map.tiles[y]![x] = { type: "soft_wall" };
      }
    }
    const issues2 = validateBombermanMapDefinition(map);
    expect(issues2.some((i) => i.code === "INVALID_WALL_DENSITY")).toBe(false);
  });
});
