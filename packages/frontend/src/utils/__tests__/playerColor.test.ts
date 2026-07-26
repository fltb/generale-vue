import { describe, it, expect } from "vitest";
import { PlayerColor } from "@generale/types";
import { tileColorNumber, playerColorCss, DEFAULT_TILE_COLOR_NUMBER, DEFAULT_PLAYER_COLOR_CSS } from "../playerColor";

const knownColorName = "Red" satisfies keyof typeof PlayerColor;

describe("tileColorNumber", () => {
  it("returns number as-is", () => {
    expect(tileColorNumber(0xff0000)).toBe(0xff0000);
  });

  it("resolves string enum name to number", () => {
    const result = tileColorNumber(knownColorName);
    expect(typeof result).toBe("number");
    expect(result).not.toBe(DEFAULT_TILE_COLOR_NUMBER);
  });

  it("returns fallback for unknown string", () => {
    expect(tileColorNumber("HotPink", 0xcccccc)).toBe(0xcccccc);
  });

  it("returns fallback for undefined", () => {
    expect(tileColorNumber(undefined)).toBe(DEFAULT_TILE_COLOR_NUMBER);
  });

  it("returns custom fallback when provided", () => {
    expect(tileColorNumber(undefined, 0x123456)).toBe(0x123456);
  });
});

describe("playerColorCss", () => {
  it("formats number to #rrggbb", () => {
    expect(playerColorCss(0xff0000)).toBe("#ff0000");
  });

  it("resolves string enum to css", () => {
    const css = playerColorCss(knownColorName);
    expect(css).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("returns fallback for null/undefined", () => {
    expect(playerColorCss(null)).toBe(DEFAULT_PLAYER_COLOR_CSS);
    expect(playerColorCss(undefined)).toBe(DEFAULT_PLAYER_COLOR_CSS);
  });

  it("returns custom fallback", () => {
    expect(playerColorCss(undefined, "#123456")).toBe("#123456");
  });
});
