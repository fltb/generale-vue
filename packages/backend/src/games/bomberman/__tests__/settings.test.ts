import { describe, it, expect } from "vitest";
import { defaultBombermanConfig, validateBombermanConfig } from "../settings";

describe("defaultBombermanConfig", () => {
  it("returns valid config with expected defaults", () => {
    const config = defaultBombermanConfig();
    expect(config.mapWidth).toBe(15);
    expect(config.mapHeight).toBe(13);
    expect(config.playerLimit).toBe(4);
    expect(config.tickRate).toBe(10);
    expect(config.bombFuse).toBe(20);
    expect(config.bombLimit).toBe(2);
    expect(config.blastRadius).toBe(2);
    expect(config.roundTimeSec).toBe(120);
    expect(config.shrinkEnabled).toBe(true);
    expect(config.itemDropRate).toBe(0.6);
  });
});

describe("validateBombermanConfig", () => {
  it("returns null for valid config", () => {
    expect(validateBombermanConfig(defaultBombermanConfig())).toBeNull();
  });

  it("rejects mapWidth below 11", () => {
    expect(validateBombermanConfig({ mapWidth: 9 })).toContain("mapWidth");
  });

  it("rejects mapWidth above 31", () => {
    expect(validateBombermanConfig({ mapWidth: 40 })).toContain("mapWidth");
  });

  it("rejects playerLimit below 2", () => {
    expect(validateBombermanConfig({ playerLimit: 1 })).toContain("playerLimit");
  });

  it("rejects playerLimit above 4", () => {
    expect(validateBombermanConfig({ playerLimit: 8 })).toContain("playerLimit");
  });

  it("rejects tickRate below 8", () => {
    expect(validateBombermanConfig({ tickRate: 7 })).toContain("tickRate");
  });

  it("rejects tickRate above 20", () => {
    expect(validateBombermanConfig({ tickRate: 21 })).toContain("tickRate");
  });

  it("returns null for partial valid config", () => {
    expect(validateBombermanConfig({ mapWidth: 21, playerLimit: 2 })).toBeNull();
  });
});
