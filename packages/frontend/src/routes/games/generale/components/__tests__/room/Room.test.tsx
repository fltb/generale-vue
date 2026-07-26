import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { PreGamePlayerStatus, TileType } from "@generale/types";
import type { PreGameRoomState } from "@generale/types";
import type { PregameController } from "~/routes/games/generale/hooks/usePreGameRoom";
import type { JSX } from "solid-js";

type MockProps = { children?: JSX.Element; [key: string]: unknown };

const gameSetting: PreGameRoomState["gameSetting"] = {
  speed: 1,
  afkThreshold: 30,
  tileGrow: {
    [TileType.Plain]: { duration: 10, growth: 1 },
    [TileType.Throne]: { duration: 0, growth: 0 },
    [TileType.Barracks]: { duration: 0, growth: 0 },
    [TileType.Mountain]: { duration: 20, growth: 1 },
    [TileType.Swamp]: { duration: 0, growth: 0 },
    [TileType.Fog]: { duration: 0, growth: 0 },
  },
};

vi.mock("@solidjs/router", () => ({
  A: (p: MockProps) => p.children,
  useNavigate: () => vi.fn(),
  useSearchParams: () => [() => ({}), vi.fn()],
}));

vi.mock("~/ui", () => ({
  Alert: (p: MockProps) => <div {...p} />,
  Button: (p: MockProps) => <button {...p}>{p.children}</button>,
  Card: (p: MockProps) => <div {...p} />,
  Panel: (p: MockProps) => <div {...p} />,
  Range: (p: MockProps) => <div {...p} />,
  TakeoverOverlay: () => null,
}));

vi.mock("~/routes/games/generale/components/room/PlayerList", () => ({
  PlayerList: () => null,
}));

vi.mock("~/routes/games/generale/components/room/PreGameControls", () => ({
  PreGameControls: () => null,
}));

vi.mock("~/routes/games/generale/components/room/PreGameMapSettingForm", () => ({
  PreGameMapSettingForm: () => null,
}));

vi.mock("~/routes/games/generale/components/room/StateForm", () => ({
  PreGameRoomStateFrom: () => null,
}));

import { RoomWithSync } from "~/routes/games/generale/components/room/Room";

function makeCtrl(overrides?: Partial<PregameController>): PregameController {
  return {
    notice: () => null,
    isKicked: () => false,
    displaced: () => false,
    room: () => ({
      gameId: "g1",
      hostId: "p1",
      roomType: "standard",
      teamMode: "ffa",
      players: [],
      teams: [],
      gameSetting,
      mapSetting: { type: "random", width: 20, height: 20, tileFrequency: {}, sizeLabel: "medium" },
      teamCount: 0,
      playerLimit: 8,
      started: false,
    }),
    selfId: () => "p1",
    isHost: () => true,
    selfReady: () => false,
    selfStatus: () => PreGamePlayerStatus.Lobby,
    gameInProgress: () => false,
    isLobby: () => true,
    isSpectating: () => false,
    onSettingChange: vi.fn(),
    onToggleReadyForSelf: vi.fn(),
    onToggleReadyForPlayer: vi.fn(),
    onKick: vi.fn(),
    onTransferHost: vi.fn(),
    onStartGame: vi.fn(),
    onLeave: vi.fn(),
    onDisband: vi.fn(),
    onMapChange: vi.fn(),
    onRoomTypeChange: vi.fn(),
    onTeamModeChange: vi.fn(),
    onEnterSpectate: vi.fn(),
    onLeaveSpectate: vi.fn(),
    onChangeTeam: vi.fn(),
    onCreateTeam: vi.fn(),
    onRenameTeam: vi.fn(),
    onDeleteTeam: vi.fn(),
    onChangeColor: vi.fn(),
    ...overrides,
  };
}

describe("RoomWithSync", () => {
  it("renders room info card", () => {
    render(() => <RoomWithSync ctrl={makeCtrl()} playerId="p1" gameId="g1" />);
    expect(screen.getByText("Room Info")).toBeInTheDocument();
  });

  it("renders game id", () => {
    render(() => <RoomWithSync ctrl={makeCtrl()} playerId="p1" gameId="g1" />);
    expect(screen.getByTestId("room-game-id")).toBeInTheDocument();
  });

  it("renders copy invite link button for host", () => {
    render(() => <RoomWithSync ctrl={makeCtrl()} playerId="p1" gameId="g1" />);
    expect(screen.getByText("Copy Invite Link")).toBeInTheDocument();
  });

  it("renders Player Limit info", () => {
    render(() => <RoomWithSync ctrl={makeCtrl()} playerId="p1" gameId="g1" />);
    expect(screen.getByText(/Player Limit/)).toBeInTheDocument();
  });

  it("hides when visible is false", () => {
    const { container } = render(() => (
      <RoomWithSync ctrl={makeCtrl()} playerId="p1" gameId="g1" visible={false} />
    ));
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.display).toBe("none");
  });
});
