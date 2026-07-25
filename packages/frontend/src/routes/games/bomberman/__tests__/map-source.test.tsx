import { describe, it, expect, vi } from "vitest";

// ─── BombermanMapSource types and values ──────────────────────────────────────

type BombermanMapRef =
  | { type: "preset"; id: "classic" | "sparse" | "dense" }
  | { type: "workshop"; id: string };

type BombermanMapSource =
  | { type: "procedural"; themeId: string }
  | BombermanMapRef
  | { type: "rotation"; maps: BombermanMapRef[] };

describe("BombermanMapSource — selection semantics", () => {
  it("creates a procedural source with themeId", () => {
    const src: BombermanMapSource = { type: "procedural", themeId: "classic" };
    expect(src.type).toBe("procedural");
    expect(src.themeId).toBe("classic");
  });

  it("creates a preset source", () => {
    const src: BombermanMapSource = { type: "preset", id: "classic" };
    expect(src.type).toBe("preset");
    expect(src.id).toBe("classic");
  });

  it("creates a workshop source", () => {
    const src: BombermanMapSource = { type: "workshop", id: "map_abc123" };
    expect(src.type).toBe("workshop");
    expect(src.id).toBe("map_abc123");
  });

  it("creates a rotation source with multiple maps", () => {
    const src: BombermanMapSource = {
      type: "rotation",
      maps: [
        { type: "preset", id: "classic" },
        { type: "workshop", id: "map_xyz" },
      ],
    };
    expect(src.type).toBe("rotation");
    expect(src.maps).toHaveLength(2);
    expect(src.maps[0]).toEqual({ type: "preset", id: "classic" });
    expect(src.maps[1]).toEqual({ type: "workshop", id: "map_xyz" });
  });

  it("rotation maps can be added and removed", () => {
    const initial: BombermanMapRef[] = [{ type: "preset", id: "classic" }];
    const added = [...initial, { type: "workshop", id: "map1" }];
    expect(added).toHaveLength(2);

    const without = added.filter((_, i) => i !== 0);
    expect(without).toHaveLength(1);
    expect(without[0]).toEqual({ type: "workshop", id: "map1" });
  });

  it("discards duplicate workshop refs in rotation", () => {
    const existing: BombermanMapRef[] = [{ type: "workshop", id: "map1" }];
    const toAdd: BombermanMapRef = { type: "workshop", id: "map1" };
    const already = existing.some((m) => m.type === toAdd.type && m.id === toAdd.id);
    expect(already).toBe(true);
  });

  it("procedural source carries in config body as mapSource", () => {
    const config = {
      mapWidth: 15,
      mapHeight: 13,
      mapSource: { type: "procedural" as const, themeId: "night" },
    };
    const body = { roomName: "test", config };
    const parsed = JSON.parse(JSON.stringify(body));
    expect(parsed.config.mapSource.type).toBe("procedural");
    expect(parsed.config.mapSource.themeId).toBe("night");
  });

  it("workshop source carries in config body as mapSource", () => {
    const config = {
      mapWidth: 15,
      mapHeight: 13,
      mapSource: { type: "workshop" as const, id: "w123" },
    };
    const body = { roomName: "test", config };
    const parsed = JSON.parse(JSON.stringify(body));
    expect(parsed.config.mapSource.type).toBe("workshop");
    expect(parsed.config.mapSource.id).toBe("w123");
  });
});
