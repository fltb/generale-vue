import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import type { BombermanPlayer } from "@generale/types";
import type { Texture } from "pixi.js";
import type { PlayerTextures } from "../../hooks/useSprites";
import { PlayerSprite } from "../EntityLayer";

// ─── Mocks ───

/** Minimal solid-pixi stubs that produce identifiable DOM elements. */
vi.mock("solid-pixi", () => {
  const Container = (props: { children?: unknown }) => (
    <div data-testid="pixi-container">{props.children as JSX.Element}</div>
  );
  const Sprite = () => <div data-testid="pixi-sprite" />;
  const Graphics = () => <div data-testid="pixi-graphics" />;
  return { Container, Sprite, Graphics };
});

vi.mock("../hooks/useInterpolatedBombermanPosition", () => ({
  useInterpolatedBombermanPosition: () => ({
    x: () => 5,
    y: () => 5,
    moving: () => false,
  }),
}));

// Prevent pixi.js import cascade — PlayerSprite doesn't call useSprites
vi.mock("../hooks/useSprites", () => ({
  useSprites: () => () => null,
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
  };

  const commonProps = {
    sprites: [makePlayerTexture()],
    bombTextures: [{} as unknown as Texture],
    colorIdx: 0,
    tick: () => 0,
    tickRate: 10,
  };

  it("renders bomb indicator sprite above player when carriedBomb is set", () => {
    render(() => (
      <PlayerSprite
        player={{ ...basePlayer, carriedBomb: "bomb-1" }}
        {...commonProps}
      />
    ));
    // Player body sprite + bomb indicator sprite = 2 sprites
    expect(screen.getAllByTestId("pixi-sprite")).toHaveLength(2);
  });

  it("does not render bomb indicator when player has no carriedBomb", () => {
    render(() => (
      <PlayerSprite
        player={basePlayer}
        {...commonProps}
      />
    ));
    // Only the player body sprite, no bomb indicator
    expect(screen.getAllByTestId("pixi-sprite")).toHaveLength(1);
  });
});
