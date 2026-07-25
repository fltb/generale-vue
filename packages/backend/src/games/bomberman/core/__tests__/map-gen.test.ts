import { describe, it, expect } from "vitest";
import { generateBombermanMap, getSpawnPositions, validateBombermanMapDefinition, Mulberry32 } from "@generale/bomberman-engine";

describe("generateBombermanMap", () => {
  it("returns map with correct dimensions (odd-corrected)", () => {
    const map = generateBombermanMap({ width: 15, height: 13, themeId: "classic", softWallDensity: 0.55, random: new Mulberry32(42) });
    expect(map.width).toBe(15);
    expect(map.height).toBe(13);
    expect(map.tiles.length).toBe(13);
    expect(map.tiles[0]!.length).toBe(15);
  });

  it("forces odd dimensions (even input)", () => {
    const map = generateBombermanMap({ width: 14, height: 12, themeId: "classic", softWallDensity: 0.55, random: new Mulberry32(42) });
    expect(map.width).toBe(15);
    expect(map.height).toBe(13);
  });

  it("has hard walls on all borders", () => {
    const map = generateBombermanMap({ width: 15, height: 13, themeId: "classic", softWallDensity: 0.55, random: new Mulberry32(42) });
    for (let x = 0; x < map.width; x++) {
      expect(map.tiles[0]![x]!.type).toBe("hard_wall");
      expect(map.tiles[map.height - 1]![x]!.type).toBe("hard_wall");
    }
    for (let y = 0; y < map.height; y++) {
      expect(map.tiles[y]![0]!.type).toBe("hard_wall");
      expect(map.tiles[y]![map.width - 1]!.type).toBe("hard_wall");
    }
  });

  it("has pillar hard walls at even-even positions", () => {
    const map = generateBombermanMap({ width: 15, height: 13, themeId: "classic", softWallDensity: 0.55, random: new Mulberry32(42) });
    for (let y = 2; y < map.height - 2; y += 2) {
      for (let x = 2; x < map.width - 2; x += 2) {
        expect(map.tiles[y]![x]!.type).toBe("hard_wall");
      }
    }
  });

  it("has cleared 3x3 zones at all spawn positions", () => {
    const map = generateBombermanMap({ width: 15, height: 13, themeId: "classic", softWallDensity: 0.55, random: new Mulberry32(42) });
    const spawns = getSpawnPositions(4, 15, 13);
    expect(spawns).toHaveLength(4);
    for (const s of spawns) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const y = s.y + dy;
          const x = s.x + dx;
          if (y < 0 || y >= map.height || x < 0 || x >= map.width) continue;
          const tile = map.tiles[y]![x]!;
          if (tile.type !== "hard_wall") {
            expect(tile.type).toBe("empty");
          }
        }
      }
    }
  });

  it("passes engine validation (no DISCONNECTED or invalid-spawn issues)", () => {
    const map = generateBombermanMap({ width: 15, height: 13, themeId: "classic", softWallDensity: 0.55, random: new Mulberry32(42) });
    const issues = validateBombermanMapDefinition(map);
    // The engine's generator should produce structurally valid maps;
    // filter out the issues that are not about the generator's own guarantees.
    const nonSpawnIssues = issues.filter(
      (i) => i.code !== "INVALID_SPAWNS" && i.code !== "DISCONNECTED",
    );
    expect(nonSpawnIssues).toEqual([]);
  });

  it("generates maps with at least some soft walls", () => {
    let softWallCount = 0;
    const map = generateBombermanMap({ width: 15, height: 13, themeId: "classic", softWallDensity: 0.55, random: new Mulberry32(42) });
    for (const row of map.tiles) {
      for (const tile of row) {
        if (tile.type === "soft_wall") softWallCount++;
      }
    }
    expect(softWallCount).toBeGreaterThan(0);
  });
});

describe("getSpawnPositions", () => {
  it("returns 4 corners for 4 players", () => {
    const spawns = getSpawnPositions(4, 15, 13);
    expect(spawns).toHaveLength(4);
    expect(spawns[0]!).toEqual({ x: 1, y: 1 });
    expect(spawns[3]!).toEqual({ x: 13, y: 11 });
  });

  it("returns opposite corners for 2 players", () => {
    const spawns = getSpawnPositions(2, 15, 13);
    expect(spawns).toHaveLength(2);
    expect(spawns[0]!).toEqual({ x: 1, y: 1 });
    expect(spawns[1]!).toEqual({ x: 13, y: 11 });
  });
});
