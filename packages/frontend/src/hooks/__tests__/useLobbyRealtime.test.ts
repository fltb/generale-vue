import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot } from "solid-js";
import { waitFor } from "@solidjs/testing-library";
import type { QueryClient } from "@tanstack/solid-query";
import type { GameInfoRoute, ListGamesQuery, LobbyClientEvent, LobbyMessage } from "@generale/types";
import {
  LobbyClientEventType,
  LobbyServerMessageType,
} from "@generale/types";
import type { ClientConnectionManager, SubConnectorClient } from "~/ws/manager";

vi.mock("~/hooks/useWebsocket", () => ({
  useWS: vi.fn(),
  useSubConnector: vi.fn(),
}));

vi.mock("@tanstack/solid-query", () => ({
  useQueryClient: vi.fn(),
}));

import { useWS, useSubConnector } from "~/hooks/useWebsocket";
import { useQueryClient } from "@tanstack/solid-query";
import { useLobbyRealtime } from "../useLobbyRealtime";

type LobbySub = SubConnectorClient<LobbyClientEvent, LobbyMessage>;
type ServerMessage = { type: string; payload: unknown };
type LobbyCallbacks = {
  open?: () => void;
  message?: (message: ServerMessage) => void;
};
type QueryFixture = { queryKey: readonly unknown[] };

function makeGame(id: string): GameInfoRoute {
  return {
    id,
    roomName: `Room ${id}`,
    playerCount: 1,
    maxPlayers: 4,
    status: "lobby",
    hasPassword: false,
    type: "standard",
    players: [],
    settings: { type: "standard" },
  };
}

function createMockChain() {
  const subCbs: LobbyCallbacks = {};
  let _ready = false;
  const sub = {
    get ready() {
      return _ready;
    },
    set ready(value: boolean) {
      _ready = value;
    },
    onOpen: vi.fn((cb: () => void) => {
      subCbs.open = cb;
    }),
    onMessage: vi.fn((cb: (message: ServerMessage) => void) => {
      subCbs.message = cb;
    }),
    send: vi.fn<(event: LobbyClientEvent) => void>(),
    close: vi.fn(),
  };
  const manager = {
    isConnected: false,
    connect: vi.fn(),
  } as Partial<ClientConnectionManager>;
  const mockQueryCache = {
    getAll: vi.fn<() => QueryFixture[]>(() => []),
  };
  const qc = {
    getQueryCache: vi.fn(() => mockQueryCache),
    setQueryData: vi.fn<(queryKey: readonly unknown[], updater: unknown) => void>(),
    invalidateQueries: vi.fn<(filters?: unknown) => void>(),
    getQueryData: vi.fn<(queryKey: readonly unknown[]) => unknown>(),
  };
  return { sub, subCbs, manager, qc, mockQueryCache };
}

async function setupLobby(options?: { isConnected?: boolean }) {
  const { sub, subCbs, manager, qc, mockQueryCache } = createMockChain();
  manager.isConnected = options?.isConnected ?? false;

  vi.mocked(useWS).mockReturnValue(manager as ClientConnectionManager);
  vi.mocked(useSubConnector).mockReturnValue(sub as LobbySub);
  vi.mocked(useQueryClient).mockReturnValue(qc as QueryClient);

  let dispose!: () => void;

  createRoot((d) => {
    dispose = d;
    const filters = (): Partial<ListGamesQuery> => ({ status: "lobby" });
    useLobbyRealtime(filters, { offset: 0, limit: 50 });
  });
  await waitFor(() => expect(sub.onMessage).toHaveBeenCalledOnce());

  return { sub, subCbs, manager, qc, mockQueryCache, dispose };
}

describe("useLobbyRealtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("connects WS if not already connected", async () => {
    const { manager, dispose } = await setupLobby({ isConnected: false });
    expect(manager.connect).toHaveBeenCalledWith(true);
    dispose();
  });

  it("does not connect WS if already connected", async () => {
    const { manager, dispose } = await setupLobby({ isConnected: true });
    expect(manager.connect).not.toHaveBeenCalled();
    dispose();
  });

  it("creates sub with lobby-games domain", async () => {
    const { dispose } = await setupLobby();
    expect(useSubConnector).toHaveBeenCalledWith(
      "lobby-games",
      expect.objectContaining({ autoOpen: true }),
    );
    dispose();
  });

  it("sends REQUEST_LIST on open", async () => {
    const { subCbs, sub, dispose } = await setupLobby();
    expect(subCbs.open).toBeDefined();

    subCbs.open!();

    expect(sub.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: LobbyClientEventType.REQUEST_LIST }),
    );
    dispose();
  });

  it("handles room-list message by applying snapshot to matching cache queries", async () => {
    const { subCbs, qc, mockQueryCache, dispose } = await setupLobby();
    const mockQuery: QueryFixture = {
      queryKey: ["games", { status: "lobby" }, 0, 50, undefined, undefined],
    };
    mockQueryCache.getAll.mockReturnValue([mockQuery]);

    subCbs.message!({
      type: LobbyServerMessageType.LIST,
      payload: [makeGame("g1")],
    });

    expect(qc.setQueryData).toHaveBeenCalledWith(
      mockQuery.queryKey,
      expect.any(Function),
    );
    dispose();
  });

  it("handles room-created message by patching cache", async () => {
    const { subCbs, qc, mockQueryCache, dispose } = await setupLobby();
    const mockQuery: QueryFixture = {
      queryKey: ["games", { status: "lobby" }, 0, 50, undefined, undefined],
    };
    mockQueryCache.getAll.mockReturnValue([mockQuery]);
    qc.getQueryData.mockReturnValue([makeGame("g1")]);

    subCbs.message!({
      type: LobbyServerMessageType.CREATED,
      payload: makeGame("g2"),
    });

    expect(qc.setQueryData).toHaveBeenCalled();
    dispose();
  });

  it("handles room-updated message by patching cache", async () => {
    const { subCbs, qc, mockQueryCache, dispose } = await setupLobby();
    const mockQuery: QueryFixture = {
      queryKey: ["games", { status: "lobby" }, 0, 50, undefined, undefined],
    };
    mockQueryCache.getAll.mockReturnValue([mockQuery]);
    qc.getQueryData.mockReturnValue([makeGame("g1")]);

    subCbs.message!({
      type: LobbyServerMessageType.UPDATED,
      payload: makeGame("g1"),
    });

    expect(qc.setQueryData).toHaveBeenCalled();
    dispose();
  });

  it("handles room-deleted message by removing from cache", async () => {
    const { subCbs, qc, mockQueryCache, dispose } = await setupLobby();
    const mockQuery: QueryFixture = {
      queryKey: ["games", { status: "lobby" }, 0, 50, undefined, undefined],
    };
    mockQueryCache.getAll.mockReturnValue([mockQuery]);
    qc.getQueryData.mockReturnValue([makeGame("g1"), makeGame("g2")]);

    subCbs.message!({
      type: LobbyServerMessageType.DELETED,
      payload: { gameId: "g1" },
    });

    expect(qc.setQueryData).toHaveBeenCalled();
    dispose();
  });

  it("handles unknown message types without error", async () => {
    const { subCbs, dispose } = await setupLobby();

    expect(() => {
      subCbs.message!({ type: "unknown-type", payload: {} });
    }).not.toThrow();

    dispose();
  });
});
