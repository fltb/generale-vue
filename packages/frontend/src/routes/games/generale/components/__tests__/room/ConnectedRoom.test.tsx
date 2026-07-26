import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { PreGamePlayerStatus } from "@generale/types";
import type { JSX } from "solid-js";

type MockProps = { children?: JSX.Element; [key: string]: unknown };
vi.mock("~/routes/games/generale/hooks/usePreGameRoom", () => ({
  usePreGameRoom: () => ({
    room: () => ({
      gameId: "test-game",
      hostId: "p1",
      players: [],
      teams: [],
      gameSetting: { speed: 1, tileGrow: {}, afkThreshold: 30 },
      mapSetting: { type: "random", width: 20, height: 20, tileFrequency: {}, sizeLabel: "medium" },
      roomType: "standard",
      teamMode: "ffa",
      teamCount: 0,
      playerLimit: 8,
      started: false,
    }),
    selfId: () => "p1",
    isHost: () => true,
    selfReady: () => false,
    selfStatus: () => PreGamePlayerStatus.Lobby,
    notice: () => null,
    isKicked: () => false,
    displaced: () => false,
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
  }),
}));

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

import { ConnectedRoom } from "~/routes/games/generale/components/room/ConnectedRoom";

describe("ConnectedRoom", () => {
  it("renders room UI", () => {
    render(() => (
      <ConnectedRoom domain="test" playerId="p1" gameId="test-game" />
    ));
    expect(screen.getByText("Room Info")).toBeInTheDocument();
  });

  it("renders game id", () => {
    render(() => (
      <ConnectedRoom domain="test" playerId="p1" gameId="test-game" />
    ));
    expect(screen.getByTestId("room-game-id")).toBeInTheDocument();
  });
});
