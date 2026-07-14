import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import type { BombermanState } from "@generale/types";
import { GameStatus, bombermanSettingsSchema } from "@generale/types";
import { BombermanGame } from "../game";

// ─── Mocks ───

vi.mock("solid-pixi", () => ({
  Application: (props: any) => {
    // Verify no resizeTo prop (black screen fix)
    if ("resizeTo" in (props as Record<string, unknown>)) {
      throw new Error("resizeTo prop should not be used — use explicit width/height");
    }
    const w = (props as Record<string, number>).width ?? 0;
    const h = (props as Record<string, number>).height ?? 0;
    return (
      <>
        <canvas
          width={w}
          height={h}
          data-testid="pixi-canvas"
          style={{ width: `${w}px`, height: `${h}px` }}
        />
        {props.children}
      </>
    );
  },
  Container: (props: any) => <div data-testid="pixi-container">{props.children}</div>,
  Sprite: () => <div data-testid="pixi-sprite" />,
  Graphics: () => <div data-testid="pixi-graphics" />,
}));

vi.mock("~/hooks/useGameSettings", () => ({
  useGameSettings: () => ({
    settings: () => ({
      bombLimit: 2,
      blastRadius: 2,
      bombFuse: 20,
      roundTimeSec: 120,
      mapSize: 11,
      shrinkEnabled: true,
      keybindings: {
        up: "ArrowUp",
        down: "ArrowDown",
        left: "ArrowLeft",
        right: "ArrowRight",
        placeBomb: "Space",
        action: "KeyE",
        detonate: "KeyQ",
      },
    }),
  }),
}));

vi.mock("~/ui/sound", () => ({
  sfx: {
    bombPlace: vi.fn(),
    explosion: vi.fn(),
    pickup: vi.fn(),
    death: vi.fn(),
    victory: vi.fn(),
    defeat: vi.fn(),
    countdownBeep: vi.fn(),
    go: vi.fn(),
  },
}));

vi.mock("../hooks/useBombermanInput", () => ({
  useBombermanInput: () => ({
    showVirtualControls: () => false,
  }),
}));

vi.mock("../components/VirtualControls", () => ({
  VirtualControls: () => <div data-testid="virtual-controls" />,
}));

vi.mock("../components/Scoreboard", () => ({
  Scoreboard: (props: any) => (
    <div data-testid="scoreboard">
      <button onClick={props.onBackToRoom}>Back</button>
    </div>
  ),
}));

vi.mock("~/ui/Countdown", () => ({
  Countdown: (props: any) => {
    // Immediately call onDone for testing post-countdown state
    setTimeout(() => props.onDone?.(), 0);
    return <div data-testid="countdown">{props.from}</div>;
  },
}));

vi.mock("../components/MapLayer", () => ({
  MapLayer: () => <div data-testid="map-layer" />,
}));

vi.mock("../components/EntityLayer", () => ({
  EntityLayer: () => <div data-testid="entity-layer" />,
}));

// ─── Helpers ───

function makeState(overrides: Partial<BombermanState> = {}): BombermanState {
  return {
    tick: 0,
    roundTimer: 120,
    shrinkBoundary: 0,
    config: {
      mapWidth: 11,
      mapHeight: 11,
      tickRate: 10,
      bombLimit: 2,
      blastRadius: 2,
      bombFuse: 20,
      speed: 1,
      roundTimeSec: 120,
      shrinkEnabled: true,
      items: [],
    },
    map: {
      tiles: Array.from({ length: 11 }, () =>
        Array.from({ length: 11 }, () => ({ type: "empty" as const })),
      ),
    },
    players: {
      player1: {
        playerId: "player1",
        name: "Player 1",
        alive: true,
        x: 1,
        y: 1,
        facing: "down",
        bombMax: 2,
        bombActive: 2,
        blastRadius: 2,
        speed: 1,
        items: [],
      },
    },
    bombs: [],
    explosions: [],
    items: [],
    status: GameStatus.Running,
    ...overrides,
  };
}

// ─── Tests ───

describe("BombermanGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Layout fix verification (Bug 1: black screen) ──

  it("renders canvas with explicit map-based dimensions, not resizeTo=window", () => {
    const initialState = makeState();
    render(() => (
      <BombermanGame
        initialState={initialState}
        onAction={() => {}}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    vi.advanceTimersByTime(100);

    // Canvas should exist with non-zero dimensions matching map grid
    const canvas = screen.getByTestId("pixi-canvas") as HTMLCanvasElement;
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    // 11×11 map × 36px tiles
    expect(canvas.width).toBe(396);
    expect(canvas.height).toBe(396);
  });

  // ── Surrender fix verification (Bug C: Show only renders first child) ──

  it("renders surrender button when player is alive", () => {
    render(() => (
      <BombermanGame
        initialState={makeState()}
        onAction={() => {}}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    // Countdown completes → game UI appears
    vi.advanceTimersByTime(100);

    expect(
      screen.getByRole("button", { name: /bomberman\.surrender/ }),
    ).toBeInTheDocument();
  });

  it("hides surrender button when playerId is missing (spectator)", () => {
    render(() => (
      <BombermanGame
        initialState={makeState()}
        onAction={() => {}}
        onBackToRoom={() => {}}
      />
    ));

    vi.advanceTimersByTime(100);

    expect(
      screen.queryByRole("button", { name: /bomberman\.surrender/ }),
    ).not.toBeInTheDocument();
  });

  // ── Tick monitor fix verification (Bug 2: connection lost false positive) ──

  it("does not show connection-lost during grace period (tick=0)", () => {
    render(() => (
      <BombermanGame
        initialState={makeState({ tick: 0 })}
        onAction={() => {}}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    // Countdown done, monitor starts, tick=0 → grace period
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(500); // one monitor tick
    vi.advanceTimersByTime(3000); // beyond threshold

    // Should NOT show connection lost (grace period active since tick=0)
    expect(
      screen.queryByText(/bomberman\.connectionLost/),
    ).not.toBeInTheDocument();
  });

  it("still shows connection-lost after real tick stops", () => {
    render(() => (
      <BombermanGame
        initialState={makeState({ tick: 5 })}
        onAction={() => {}}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    // Countdown done, monitor starts, tick=5 → monitoring active immediately
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(500); // first monitor tick, sees tick=5

    // Advance past 3s with no tick change
    vi.advanceTimersByTime(3500);

    expect(
      screen.queryByText(/bomberman\.connectionLost/),
    ).toBeInTheDocument();
  });

  // ── Controls help ──

  it("shows controls help overlay by default", () => {
    render(() => (
      <BombermanGame
        initialState={makeState()}
        onAction={() => {}}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    vi.advanceTimersByTime(100);

    // Controls help should be visible after countdown
    expect(screen.getByText(/bomberman\.controls/)).toBeInTheDocument();
  });

  // ── HUD integration ──

  it("renders time from state", () => {
    render(() => (
      <BombermanGame
        initialState={makeState({ roundTimer: 120 })}
        onAction={() => {}}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    vi.advanceTimersByTime(100);
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  // ── Scoreboard on game end ──

  it("shows scoreboard when game ends", () => {
    render(() => (
      <BombermanGame
        initialState={makeState({
          status: GameStatus.Ended,
          players: {
            player1: {
              playerId: "player1",
              name: "Winner",
              alive: true,
              x: 1,
              y: 1,
              facing: "down",
              bombMax: 2,
              bombActive: 2,
              blastRadius: 2,
              speed: 1,
              items: [],
            },
          },
        })}
        onAction={() => {}}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    vi.advanceTimersByTime(100);
    expect(screen.getByTestId("scoreboard")).toBeInTheDocument();
  });
});
