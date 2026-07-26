import { describe, it, expect } from "vitest";
import { DEFAULT_TILE_THEME, DIRECTION_ICON } from "../../render/tileTheme";

describe("DEFAULT_TILE_THEME", () => {
  it("contains the complete theme shape and icon mapping", () => {
    expect(DEFAULT_TILE_THEME).toEqual({
      tileSize: 36,
      colors: {
        fog: 0x444444,
        unowned: 0xffffff,
        gridStroke: 0x000000,
        gridStrokeAlpha: 0.15,
        tileIcon: 0x222222,
        cursor: 0xffd34d,
        arrow: 0x222222,
        appBackground: "#1099bb",
      },
      tileIcon: {
        PLAIN: null,
        FOG: null,
        THRONE: "faCrown",
        BARRACKS: "faHelmetSafety",
        MOUNTAIN: "faMountain",
        SWAMP: "faWater",
      },
    });
  });
});

describe("DIRECTION_ICON", () => {
  it("maps all four directions", () => {
    expect(DIRECTION_ICON).toEqual({
      right: "faArrowRight",
      left: "faArrowLeft",
      up: "faArrowUp",
      down: "faArrowDown",
    });
  });
});
