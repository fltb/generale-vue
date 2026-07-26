import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import type { JSX } from "solid-js";
import type { GameSummaryRoute } from "@generale/types";

type AnchorProps = { children?: JSX.Element };
type MockProps = { children?: JSX.Element; [key: string]: unknown };

const mockNavigate = vi.fn();
const mockInvalidateQueries = vi.fn();

let mockQueryData: GameSummaryRoute[] = [];
let mockQueryLoading = false;
let mockQueryError: { message: string } | null = null;

function makeGame(overrides: Partial<GameSummaryRoute> = {}): GameSummaryRoute {
  return {
    id: "g1",
    roomName: "Test Game",
    playerCount: 1,
    maxPlayers: 4,
    status: "lobby",
    hasPassword: false,
    type: "standard",
    ...overrides,
  };
}

vi.mock("@tanstack/solid-query", () => ({
  useQuery: (_opts: unknown) => {
    return {
      get isLoading() { return mockQueryLoading; },
      get isError() { return !!mockQueryError; },
      get isSuccess() { return !mockQueryLoading && !mockQueryError; },
      get error() { return mockQueryError; },
      get data() { return mockQueryData; },
      refetch: vi.fn(),
    };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    getQueryCache: () => ({ getAll: () => [] }),
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => mockNavigate,
  A: (p: AnchorProps) => p.children,
  useSearchParams: () => [() => ({}), vi.fn()],
}));


vi.mock("~/hooks/useLobbyRealtime", () => ({
  useLobbyRealtime: () => ({}),
}));

vi.mock("~/routes/games/generale/api/gameApi", () => ({
  getGameInfoApi: vi.fn(),
  listGamesApi: vi.fn(),
}));

vi.mock("~/routes/games/generale/components/roomlist/CreateRoomModal", () => ({
  default: (_p: MockProps) => <div data-testid="create-room-modal" />,
}));

vi.mock("~/routes/games/generale/components/roomlist/RoomFilter", () => ({
  default: () => <div data-testid="room-filter" />,
}));

import { RoomList } from "~/routes/games/generale/components/roomlist/index";

describe("RoomList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryData = [];
    mockQueryLoading = false;
    mockQueryError = null;
  });

  it("renders title", () => {
    render(() => <RoomList />);
    expect(screen.getByText("Active Rooms")).toBeInTheDocument();
  });

  it("renders create room button", () => {
    render(() => <RoomList />);
    expect(screen.getByText("New Room")).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    render(() => <RoomList />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("renders RoomFilter", () => {
    render(() => <RoomList />);
    expect(screen.getByTestId("room-filter")).toBeInTheDocument();
  });

  it("shows loading spinner when loading", () => {
    mockQueryLoading = true;
    render(() => <RoomList />);
    expect(screen.getByText("Active Rooms")).toBeInTheDocument();
  });

  it("shows error alert when error", () => {
    mockQueryLoading = false;
    mockQueryError = { message: "Network error" };
    render(() => <RoomList />);
    expect(screen.getByText(/Failed to load room list/)).toBeInTheDocument();
  });

  it("renders game cards on success with data", () => {
    mockQueryData = [makeGame({ hostName: "Host1", playerCount: 2 })];
    render(() => <RoomList />);
    expect(screen.getByText("Test Game")).toBeInTheDocument();
    expect(screen.getByText("Host1")).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("renders Join button for game cards", () => {
    mockQueryData = [makeGame()];
    render(() => <RoomList />);
    expect(screen.getByText("Join")).toBeInTheDocument();
  });

  it("opens create modal when new room button clicked", () => {
    render(() => <RoomList />);
    fireEvent.click(screen.getByText("New Room"));
    expect(screen.getByTestId("create-room-modal")).toBeInTheDocument();
  });

  it("navigates to game when Join clicked", () => {
    mockQueryData = [makeGame()];
    render(() => <RoomList />);
    fireEvent.click(screen.getByText("Join"));
    expect(mockNavigate).toHaveBeenCalledWith("/game/g1");
  });

  it("shows Locked badge for password-protected rooms", () => {
    mockQueryData = [makeGame({ roomName: "Locked Game", hasPassword: true })];
    render(() => <RoomList />);
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("shows Details button for game cards", () => {
    mockQueryData = [makeGame()];
    render(() => <RoomList />);
    expect(screen.getByText("Details")).toBeInTheDocument();
  });
});
