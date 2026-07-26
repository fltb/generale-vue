import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import type { JSX } from "solid-js";

const mockSession = vi.hoisted(() => {
  const match = {
    format: "bo3",
    targetWins: 2,
    currentRound: 2,
    currentAttempt: 1,
    scores: [{ competitor: { kind: "player", id: "p1" }, wins: 1 }],
    roundResults: [
      {
        roundNumber: 1,
        attempt: 1,
        winner: { kind: "player", id: "p1" },
        reason: "last_alive",
        ticks: 100,
      },
    ],
    winner: null,
    nextRoundStartsAt: Date.now() + 5_000,
  };
  const state = {
    roomName: "Test Room",
    players: [{ id: "p1", name: "Alice", isHost: true, ready: true, status: "playing", teamId: "team1" }],
    config: { teamMode: "ffa" },
    phase: "between_rounds",
    maxPlayers: 4,
    hostId: "p1",
    match,
    teams: [],
    spectators: [],
  };
  return {
    state,
    match,
    session: {
      phase: () => "between_rounds",
      error: () => "",
      playerId: () => "p1",
      chatDomain: () => null,
      roomSync: { state: () => state, dispatch: vi.fn() },
      gameSync: { state: () => null },
      matchRankings: () => null,
      selfStatus: () => "playing",
      startGame: vi.fn(),
      enterSpectate: vi.fn(),
      leaveSpectate: vi.fn(),
      hasPassword: () => false,
      roomPassword: () => null,
      needsPassword: () => false,
      wrongPassword: () => false,
      setPassword: vi.fn(),
      displaced: () => false,
      showingGameUI: () => true,
      gameJustEnded: () => false,
      startedThisSession: () => false,
      handleDismissGameEnd: vi.fn(),
    },
  };
});

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ id: "room-123" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("~/components/ProtectedRoute", () => ({
  ProtectedRoute: (props: { children?: JSX.Element }) => <>{props.children}</>,
}));

vi.mock("~/i18n/useT", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

vi.mock("~/ui", () => {
  const passthrough = (props: { children?: JSX.Element }) => <>{props.children}</>;
  return {
    Alert: passthrough,
    Badge: passthrough,
    Button: passthrough,
    Card: passthrough,
    Input: passthrough,
    Select: passthrough,
    Spinner: () => <div data-testid="spinner" />,
  };
});

vi.mock("~/ui/Overlay", () => ({ TakeoverOverlay: () => null }));
vi.mock("~/components/ChatPanel", () => ({ default: () => null }));
vi.mock("../game", () => ({ BombermanGame: () => <div data-testid="bomberman-game" /> }));
vi.mock("../hooks/useBombermanRoomSession", () => ({
  useBombermanRoomSession: () => mockSession.session,
}));

vi.mock("~/hooks/useGameSettings", () => ({
  useGameSettings: () => ({
    settings: () => ({
      highContrast: false,
      colorVision: "default",
      selectedSkinId: "default",
    }),
    isLoading: () => false,
    isHydrated: () => true,
    update: vi.fn(),
  }),
}));

import { BombermanRoom } from "../room";

describe("BombermanRoom between-rounds state", () => {
  it("renders the round result, score, and deadline without game state", () => {
    render(() => <BombermanRoom />);

    expect(screen.getByTestId("bomberman-between-rounds")).toBeInTheDocument();
    expect(screen.getByText("bomberman.roundResult")).toBeInTheDocument();
    expect(screen.getByText("bomberman.finalScore")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    const countdown = screen.getByTestId("bomberman-between-rounds-countdown");
    expect(countdown).toHaveTextContent(
      String(Math.max(0, Math.ceil((mockSession.match.nextRoundStartsAt - Date.now()) / 1000))),
    );
    expect(screen.queryByTestId("bomberman-game")).not.toBeInTheDocument();
  });
});
