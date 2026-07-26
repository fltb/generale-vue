import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import {
  BOMBERMAN_REPLAY_ENGINE_VERSION,
  createBombermanMatchState,
  type BombermanReplay,
  type BombermanReplayRound,
  type BombermanState,
} from "@generale/types";
import { createInitialBombermanState } from "@generale/bomberman-engine";

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "replay-1" }),
}));

vi.mock("@tanstack/solid-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("~/components/ProtectedRoute", () => ({
  ProtectedRoute: (props: { children: JSX.Element }) => props.children,
}));

vi.mock("../components/MapLayer", () => ({
  MapLayer: () => <div data-testid="replay-map" />,
}));

vi.mock("../components/EntityLayer", () => ({
  EntityLayer: () => <div data-testid="replay-entities" />,
}));

vi.mock("~/hooks/useGameSettings", () => ({
  useGameSettings: () => ({
    settings: () => ({
      highContrast: false,
      colorVision: "default",
      selectedSkinId: "default",
    }),
    update: vi.fn(),
  }),
}));

import { useQuery } from "@tanstack/solid-query";
import { BombermanReplayPlayer } from "../replay-player";

function makeInitialState(): BombermanState {
  return createInitialBombermanState({
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
      itemDropRate: 0,
    },
    seed: 42,
    map: {
      schemaVersion: 1,
      width: 11,
      height: 11,
      themeId: "classic",
      tiles: Array.from({ length: 11 }, () =>
        Array.from({ length: 11 }, () => ({ type: "empty" as const })),
      ),
      spawns: [{ x: 1, y: 1 }, { x: 9, y: 9 }],
      fixedItems: [],
    },
    players: [
      { id: "p1", name: "Player 1", teamId: "team1", isBot: false, skinId: "classic-blue" },
      { id: "p2", name: "Player 2", teamId: "team2", isBot: false, skinId: "classic-green" },
    ],
  });
}

function makeRound(): BombermanReplayRound {
  return {
    roundNumber: 1,
    attempt: 1,
    seed: 42,
    initialState: makeInitialState(),
    frames: [
      {
        tick: 0,
        operations: [
          { playerId: "p1", operation: { type: "NOOP" } },
          { playerId: "p2", operation: { type: "NOOP" } },
        ],
      },
      {
        tick: 1,
        operations: [
          { playerId: "p1", operation: { type: "NOOP" } },
          { playerId: "p2", operation: { type: "NOOP" } },
        ],
      },
    ],
    result: {
      roundNumber: 1,
      attempt: 1,
      winner: null,
      reason: "draw",
      ticks: 2,
    },
  };
}

function makeReplay(engineVersion = BOMBERMAN_REPLAY_ENGINE_VERSION): BombermanReplay {
  return {
    schemaVersion: 1,
    engineVersion,
    matchId: "match-1",
    config: makeInitialState().config,
    participants: [
      { playerId: "p1", name: "Player 1", teamId: "team1", skinId: "classic-blue", isBot: false },
      { playerId: "p2", name: "Player 2", teamId: "team2", skinId: "classic-green", isBot: false },
    ],
    rounds: [makeRound()],
    result: createBombermanMatchState("single"),
  };
}

function mockLoadedReplay(replay: BombermanReplay) {
  vi.mocked(useQuery).mockReturnValue({
    data: replay,
    isLoading: false,
    isError: false,
    isSuccess: true,
    error: null,
  });
}
describe("BombermanReplayPlayer controls", () => {

  it("renders a real alert and no playback controls for an incompatible engine version", async () => {
    mockLoadedReplay(makeReplay(BOMBERMAN_REPLAY_ENGINE_VERSION + 1));
    render(() => <BombermanReplayPlayer />);

    const warning = await screen.findByText("bomberman.replay.versionMismatch");
    expect(warning.closest(".alert")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bomberman.replay.play" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "bomberman.replay.stepForward" })).not.toBeInTheDocument();
  });
  it("renders compatible replay controls and updates tick and play state through clicks", async () => {
    mockLoadedReplay(makeReplay());
    render(() => <BombermanReplayPlayer />);

    expect(await screen.findByRole("button", { name: "bomberman.replay.play" })).toBeInTheDocument();
    expect(screen.getByText("bomberman.replay.tick: 0/2 (0:00)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "bomberman.replay.stepForward" }));
    await waitFor(() => expect(screen.getByText("bomberman.replay.tick: 1/2 (0:00)")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "bomberman.replay.play" }));
    expect(screen.getByRole("button", { name: "bomberman.replay.pause" })).toBeInTheDocument();
  });
});
