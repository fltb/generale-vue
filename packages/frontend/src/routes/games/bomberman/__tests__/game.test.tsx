import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JSX } from "solid-js";
import { render, screen } from "@solidjs/testing-library";
import type { BombermanState, BombermanOperation, BombermanTile } from "@generale/types";
import { bombermanSettingsSchema } from "@generale/types";
import { BombermanGame } from "../game";
import type { SyncedState } from "../hooks/useBombermanRoomSession";

type MockProps = { children?: JSX.Element; [key: string]: unknown };
type ApplicationProps = MockProps & { width?: unknown; height?: unknown; resizeTo?: unknown };
type VirtualControlsProps = MockProps & {
  onAction: (operation: BombermanOperation) => void;
};
type ScoreboardProps = MockProps & { onBackToRoom: () => void };
type CountdownProps = MockProps & { from?: number; onDone?: () => void };

// ─── Mocks ───
vi.mock("solid-pixi", () => ({
  Application: (props: ApplicationProps) => {
    // Verify no resizeTo prop (black screen fix)
    if ("resizeTo" in props) {
      throw new Error("resizeTo prop should not be used — use explicit width/height");
    }
    const w = typeof props.width === "number" ? props.width : 0;
    const h = typeof props.height === "number" ? props.height : 0;
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
  Container: (props: MockProps) => <div data-testid="pixi-container">{props.children}</div>,
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
    showVirtualControls: () => true,
  }),
}));
let capturedOnAction: ((op: BombermanOperation) => void) | null = null;
vi.mock("../components/VirtualControls", () => ({
  VirtualControls: (props: VirtualControlsProps) => {
    capturedOnAction = props.onAction;
    return <div data-testid="virtual-controls" />;
  },
}));
vi.mock("../components/Scoreboard", () => ({
  Scoreboard: (props: ScoreboardProps) => (
    <div data-testid="scoreboard">
      <button onClick={props.onBackToRoom}>Back</button>
    </div>
  ),
}));
vi.mock("~/ui/Countdown", () => ({
  Countdown: (props: CountdownProps) => {
    // Complete on the next timer tick so tests can control the transition exactly.
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
function emptyTile(): BombermanTile {
  return { type: "empty" };
}

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
        Array.from({ length: 11 }, emptyTile),
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
    ...overrides,
  };
}

function makeGameSync(state: BombermanState): SyncedState<BombermanState, BombermanOperation> {
  return {
    state: () => state,
    dispatch: vi.fn<(action: BombermanOperation) => number>(() => 0),
    connect: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    disconnect: vi.fn<() => void>(),
    isReady: () => true,
  };
}

// ─── Tests ───

describe("BombermanGame", () => {
  beforeEach(() => {
    capturedOnAction = null;
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
        gameSync={makeGameSync(initialState)}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    vi.advanceTimersByTime(0);

    // Canvas should exist with non-zero dimensions matching map grid
    const canvas = screen.getByTestId("pixi-canvas");
    expect(canvas).toHaveAttribute("width", "396");
    expect(canvas).toHaveAttribute("height", "396");
  });

  // ── Surrender fix verification (Bug C: Show only renders first child) ──

  it("renders surrender button when player is alive", () => {
    render(() => (
      <BombermanGame
        gameSync={makeGameSync(makeState())}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    // Countdown completes → game UI appears
    vi.advanceTimersByTime(0);

    expect(
      screen.getByRole("button", { name: /bomberman\.surrender/ }),
    ).toBeInTheDocument();
  });

  it("hides surrender button when playerId is missing (spectator)", () => {
    render(() => (
      <BombermanGame
        gameSync={makeGameSync(makeState())}
        onBackToRoom={() => {}}
      />
    ));

    vi.advanceTimersByTime(0);

    expect(
      screen.queryByRole("button", { name: /bomberman\.surrender/ }),
    ).not.toBeInTheDocument();
  });

  // ── Tick monitor fix verification (Bug 2: connection lost false positive) ──

  it("does not show connection-lost during grace period (tick=0)", () => {
    render(() => (
      <BombermanGame
        gameSync={makeGameSync(makeState({ tick: 0 }))}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    // Countdown done, monitor starts, tick=0 → grace period
    vi.advanceTimersByTime(0);
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
        gameSync={makeGameSync(makeState({ tick: 5 }))}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    // Countdown done, monitor starts, tick=5 → monitoring active immediately
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(500); // first monitor tick, sees tick=5

    // Advance past 3s with no tick change
    vi.advanceTimersByTime(3001);

    expect(
      screen.queryByText(/bomberman\.connectionLost/),
    ).toBeInTheDocument();
  });

  // ── Controls help ──

  it("shows controls help overlay by default", () => {
    render(() => (
      <BombermanGame
        gameSync={makeGameSync(makeState())}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    vi.advanceTimersByTime(0);

    // Controls help should be visible after countdown
    expect(screen.getByText(/bomberman\.controls/)).toBeInTheDocument();
  });

  // ── HUD integration ──

  it("renders time from state", () => {
    render(() => (
      <BombermanGame
        gameSync={makeGameSync(makeState({ roundTimer: 120 }))}
        onBackToRoom={() => {}}
        playerId="player1"
      />
    ));

    vi.advanceTimersByTime(0);
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  // ── Scoreboard on game end ──


  it("gates virtual ACTION/DETONATE behind countdown when freshStart is true", () => {
    const state = makeState();
    const gameSync = makeGameSync(state);
    render(() => (
      <BombermanGame
        gameSync={gameSync}
        onBackToRoom={() => {}}
        playerId="player1"
        freshStart={true}
      />
    ));

    // Should have captured the onAction prop from VirtualControls
    expect(capturedOnAction).toBeTruthy();

    // Before countdown completes — gate should block
    capturedOnAction?.({ type: "ACTION" });
    capturedOnAction?.({ type: "DETONATE" });
    expect(gameSync.dispatch).not.toHaveBeenCalled();

    // Complete countdown
    vi.advanceTimersByTime(0);

    // After countdown completes — gate should forward
    capturedOnAction?.({ type: "ACTION" });
    expect(gameSync.dispatch).toHaveBeenCalledWith({ type: "ACTION" });

    capturedOnAction?.({ type: "DETONATE" });
    expect(gameSync.dispatch).toHaveBeenCalledWith({ type: "DETONATE" });
  });
});
