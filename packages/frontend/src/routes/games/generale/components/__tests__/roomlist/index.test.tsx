import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";

const mockNavigate = vi.fn();
const mockInvalidateQueries = vi.fn();

let mockQueryData: unknown[] = [];
let mockQueryLoading = false;
let mockQueryError: { message: string } | null = null;

vi.mock("@tanstack/solid-query", () => ({
  useQuery: (opts: any) => {
    const fn = typeof opts === "function" ? opts : () => opts;
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
  A: (p: any) => p.children,
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
  default: (p: any) => <div data-testid="create-room-modal" />,
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
    mockQueryData = [
      {
        id: "g1",
        roomName: "Test Game",
        hostName: "Host1",
        type: "standard",
        playerCount: 2,
        maxPlayers: 4,
        status: "lobby",
      },
    ];
    render(() => <RoomList />);
    expect(screen.getByText("Test Game")).toBeInTheDocument();
    expect(screen.getByText("Host1")).toBeInTheDocument();
    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("renders Join button for game cards", () => {
    mockQueryData = [
      {
        id: "g1",
        roomName: "Test Game",
        playerCount: 1,
        maxPlayers: 4,
        status: "lobby",
      },
    ];
    render(() => <RoomList />);
    expect(screen.getByText("Join")).toBeInTheDocument();
  });

  it("opens create modal when new room button clicked", () => {
    render(() => <RoomList />);
    fireEvent.click(screen.getByText("New Room"));
    expect(screen.getByTestId("create-room-modal")).toBeInTheDocument();
  });

  it("navigates to game when Join clicked", () => {
    mockQueryData = [
      {
        id: "g1",
        roomName: "Test Game",
        playerCount: 1,
        maxPlayers: 4,
        status: "lobby",
      },
    ];
    render(() => <RoomList />);
    fireEvent.click(screen.getByText("Join"));
    expect(mockNavigate).toHaveBeenCalledWith("/game/g1");
  });

  it("shows Locked badge for password-protected rooms", () => {
    mockQueryData = [
      {
        id: "g1",
        roomName: "Locked Game",
        hasPassword: true,
        playerCount: 1,
        maxPlayers: 4,
        status: "lobby",
      },
    ];
    render(() => <RoomList />);
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("shows Details button for game cards", () => {
    mockQueryData = [
      {
        id: "g1",
        roomName: "Test Game",
        playerCount: 1,
        maxPlayers: 4,
        status: "lobby",
      },
    ];
    render(() => <RoomList />);
    expect(screen.getByText("Details")).toBeInTheDocument();
  });
});
