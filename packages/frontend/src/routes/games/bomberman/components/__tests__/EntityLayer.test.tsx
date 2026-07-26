import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import type { BombermanPlayer, Item } from "@generale/types";
import type { Texture } from "pixi.js";
import type { PlayerTextures } from "../../hooks/useSprites";
import { EntityLayer, PlayerSprite } from "../EntityLayer";

// ─── Mocks ───

/** Minimal solid-pixi stubs that produce identifiable DOM elements. */
vi.mock("solid-pixi", () => {
  const Container = (props: { children?: unknown; zIndex?: number; sortableChildren?: boolean }) => (
    <div data-testid="pixi-container" data-z={props.zIndex}>
      {props.children as JSX.Element}
    </div>
  );
  const Sprite = (props: { y?: number; zIndex?: number; texture?: unknown; children?: unknown }) => (
    <div data-testid="pixi-sprite" data-y={props.y} data-z={props.zIndex}>
      {props.children as JSX.Element}
    </div>
  );
  const Graphics = (props: { y?: number; zIndex?: number; ref?: unknown; x?: number; children?: unknown }) => (
    <div data-testid="pixi-graphics" data-y={props.y} data-z={props.zIndex}>
      {props.children as JSX.Element}
    </div>
  );
  return { Container, Sprite, Graphics };
});

vi.mock("../hooks/useInterpolatedBombermanPosition", () => ({
  useInterpolatedBombermanPosition: () => ({
    x: () => 5,
    y: () => 5,
    moving: () => false,
  }),
}));

// Prevent pixi.js import cascade
vi.mock("../../hooks/useSprites", () => {
  const t = {} as unknown as Texture;
  return {
    useSprites: () => () => ({
      players: [],
      bombs: [],
      explosions: [],
      items: {
        BOMB_UP: t,
        FIRE_UP: t,
        SPEED_UP: t,
        KICK: t,
        GLOVE: t,
        PUNCH: t,
        REMOTE: t,
        PIERCE: t,
        SPIRIT: t,
      },
    }),
  };
});

vi.mock("../../itemDisplay", () => ({
  itemAccentNumber: () => 0xff8800,
}));

// ─── Helpers ───

function makePlayerTexture(): PlayerTextures {
  // Texture is a complex pixi.js type we can't construct outside of
  // the full rendering pipeline; empty objects satisfy the shape for
  // mocked sprite rendering.
  const t = {} as unknown as Texture;
  return {
    idleDown: t,
    walkDown: [t],
    idleRight: t,
    walkRight: [t],
    idleUp: t,
    walkUp: [t],
    walkLeft: [t],
    idleLeft: t,
  };
}

// ─── Tests ───

describe("PlayerSprite carriedBomb visual", () => {
  const basePlayer: BombermanPlayer = {
    playerId: "p1",
    name: "Test",
    alive: true,
    x: 5,
    y: 5,
    facing: "down",
    bombMax: 2,
    bombActive: 0,
    blastRadius: 1,
    speed: 1,
    items: [],
    skinId: "classic-blue",
  };

  const commonProps = {
    sprites: [makePlayerTexture()],
    bombTextures: [{} as unknown as Texture],
    colorIdx: 0,
    tick: () => 0,
    tickRate: 10,
  };

  it("player root container has zIndex=10", () => {
    render(() => (
      <PlayerSprite
        player={{ ...basePlayer, carriedBomb: "bomb-1" }}
        {...commonProps}
      />
    ));
    const container = screen.getByTestId("pixi-container");
    expect(container).toHaveAttribute("data-z", "10");
  });

  it("with carriedBomb and player.y >= 1, indicator renders below player (y offset > 0)", () => {
    const playerAtY5 = { ...basePlayer, y: 5, carriedBomb: "bomb-1" };
    render(() => (
      <PlayerSprite
        player={playerAtY5}
        {...commonProps}
      />
    ));
    const sprites = screen.getAllByTestId("pixi-sprite");
    // Player body sprite (at interpolated y=5) + indicator sprite + ring graphics
    expect(sprites.length).toBeGreaterThanOrEqual(2);
    const playerSprite = sprites[0];
    const indicatorSprite = sprites[1];
    // Indicator should have y < player's interpolated y (since it's offset upward for y >= 1)
    const playerY = parseInt(playerSprite.getAttribute("data-y") || "0");
    const indicatorY = parseInt(indicatorSprite.getAttribute("data-y") || "0");
    expect(indicatorY).toBeLessThan(playerY);
  });

  it("with carriedBomb and player.y = 0, indicator renders above player (y offset > 0)", () => {
    const playerAtY0 = { ...basePlayer, y: 0, carriedBomb: "bomb-1" };
    render(() => (
      <PlayerSprite
        player={playerAtY0}
        {...commonProps}
      />
    ));
    const sprites = screen.getAllByTestId("pixi-sprite");
    expect(sprites.length).toBeGreaterThanOrEqual(2);
    const playerSprite = sprites[0];
    const indicatorSprite = sprites[1];
    // player at y=0: indicator should have higher y (offset downward)
    const playerY = parseInt(playerSprite.getAttribute("data-y") || "0");
    const indicatorY = parseInt(indicatorSprite.getAttribute("data-y") || "0");
    expect(indicatorY).toBeGreaterThan(playerY);
  });

  it("does not render bomb indicator when player has no carriedBomb", () => {
    render(() => (
      <PlayerSprite
        player={basePlayer}
        {...commonProps}
      />
    ));
    // Only the player body sprite, no bomb indicator or ring
    expect(screen.getAllByTestId("pixi-sprite")).toHaveLength(1);
  });
});

describe("EntityLayer items", () => {
  it("renders 2 item plates + 2 item sprites for 2 items", () => {
    const items: Item[] = [
      { x: 1, y: 1, type: "BOMB_UP" },
      { x: 2, y: 2, type: "FIRE_UP" },
    ];

    const props = {
      players: [],
      bombs: [],
      explosions: [],
      items,
      tickRate: 10,
      reducedMotion: false,
      highContrast: false,
      colorVision: "default" as const,
    };

    render(() => <EntityLayer {...props} />);

    // Each item should have: 1 plate (graphics) + 1 sprite = 2 elements per item
    const graphics = screen.getAllByTestId("pixi-graphics");
    const sprites = screen.getAllByTestId("pixi-sprite");
    expect(graphics).toHaveLength(2);
    expect(sprites).toHaveLength(2);
  });
});
