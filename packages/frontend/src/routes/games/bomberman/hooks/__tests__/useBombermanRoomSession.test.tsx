import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";

vi.mock("~/hooks/useWebsocket", () => ({
  useWS: vi.fn(),
}));

import { useWS } from "~/hooks/useWebsocket";
import type { ClientConnectionManager } from "~/ws/manager";
import { useBombermanRoomSession } from "../useBombermanRoomSession";

type ServerRole = "player" | "spectator";
type TestSub = {
  readonly domain: string;
  ready: boolean;
  onOpen(callback: () => void): void;
  onMessage(callback: (payload: unknown) => void): void;
  onDisconnect(callback: (error?: Error) => void): void;
  onClose(callback: (code?: number, reason?: string) => void): void;
  send(payload: unknown): void;
  close(): void;
};

function createMockManager() {
  const subs = new Map<string, TestSub>();
  const openDomain = vi.fn<(domain: string, payload?: Record<string, unknown>) => void>();
  const manager = {
    isConnected: true,
    connect: vi.fn(),
    openDomain,
    getOrCreateSub(domain: string) {
      const existing = subs.get(domain);
      if (existing) return existing;
      let openCallback: (() => void) | undefined;
      let messageCallback: ((payload: unknown) => void) | undefined;
      let disconnectCallback: ((error?: Error) => void) | undefined;
      let closeCallback: ((code?: number, reason?: string) => void) | undefined;
      const sub: TestSub = {
        domain,
        ready: false,
        onOpen(callback) {
          openCallback = callback;
        },
        onMessage(callback) {
          messageCallback = callback;
        },
        onDisconnect(callback) {
          disconnectCallback = callback;
        },
        onClose(callback) {
          closeCallback = callback;
        },
        send: vi.fn(),
        close: vi.fn(() => {
          sub.ready = false;
          closeCallback?.();
        }),
      };
      void openCallback;
      void messageCallback;
      void disconnectCallback;
      subs.set(domain, sub);
      return sub;
    },
  };
  return { manager, openDomain, subs };
}

function connectResponse(role?: ServerRole, phase: "lobby" | "playing" | "between_rounds" = "playing") {
  return {
    success: true,
    data: {
      playerId: "player-1",
      phase,
      ...(role ? { role } : {}),
      domains: { primary: "room-domain", game: "game-domain", chat: "chat-domain" },
    },
  };
}

function SessionHarness(props: { password?: string; role?: ServerRole }): JSX.Element {
  const session = useBombermanRoomSession({
    id: "room-reload",
    password: props.password,
    role: props.role,
  });
  return (
    <>
      <output data-testid="phase">{session.phase()}</output>
      <output data-testid="self-status">{session.selfStatus()}</output>
      <output data-testid="showing-game-ui">{String(session.showingGameUI())}</output>
    </>
  );
}

describe("useBombermanRoomSession role-aware entry", () => {
  function setup() {
    sessionStorage.clear();
    const mockManager = createMockManager();
    vi.mocked(useWS).mockReturnValue(mockManager.manager as ClientConnectionManager);
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    return { fetchMock, mockManager };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects a player without a role query and shows game UI", async () => {
    const { fetchMock, mockManager } = setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(connectResponse("player"))));
    render(() => <SessionHarness />);

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("playing"));
    expect(fetchMock).toHaveBeenCalledWith("/api/bomberman/room/connect/room-reload");
    expect(screen.getByTestId("self-status")).toHaveTextContent("playing");
    expect(screen.getByTestId("showing-game-ui")).toHaveTextContent("true");
    expect(mockManager.openDomain).toHaveBeenCalledWith("room-room-reload", { role: "player" });
    expect(mockManager.openDomain).toHaveBeenCalledWith("game-room-reload", { role: "player" });
  });

  it("connects a spectator with role=spectator and keeps spectator status", async () => {
    const { fetchMock, mockManager } = setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(connectResponse("spectator"))));
    render(() => <SessionHarness role="spectator" />);

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("playing"));
    expect(fetchMock).toHaveBeenCalledWith("/api/bomberman/room/connect/room-reload?role=spectator");
    expect(screen.getByTestId("self-status")).toHaveTextContent("spectating");
    expect(screen.getByTestId("showing-game-ui")).toHaveTextContent("true");
    expect(mockManager.openDomain).toHaveBeenCalledWith("room-room-reload", { role: "spectator" });
    expect(mockManager.openDomain).toHaveBeenCalledWith("game-room-reload", { role: "spectator" });
  });

  it("passes password and role to the room transport payload", async () => {
    const { fetchMock, mockManager } = setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(connectResponse("spectator", "lobby"))));
    render(() => <SessionHarness password="secret" role="spectator" />);

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("lobby"));
    expect(mockManager.openDomain).toHaveBeenCalledWith("room-room-reload", {
      password: "secret",
      role: "spectator",
    });
  });

  it("falls back to player when the server omits role", async () => {
    const { fetchMock, mockManager } = setup();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(connectResponse(undefined, "between_rounds"))));
    render(() => <SessionHarness />);

    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("between_rounds"));
    expect(screen.getByTestId("self-status")).toHaveTextContent("playing");
    expect(mockManager.openDomain).toHaveBeenCalledWith("room-room-reload", { role: "player" });
  });
});
