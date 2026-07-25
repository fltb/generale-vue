import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import type { JSX } from "solid-js";

const syncMocks = vi.hoisted(() => {
  const calls: Array<{ options: { initialState: unknown }; handle: Record<string, unknown> }> = [];
  const useSyncedState = vi.fn((options: { initialState: unknown }) => {
    const handle = {
      state: vi.fn(() => options.initialState),
      dispatch: vi.fn(() => 1),
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(),
      isReady: vi.fn(() => false),
      reset: vi.fn(),
    };
    calls.push({ options, handle });
    return handle;
  });
  return { calls, useSyncedState };
});

vi.mock("~/hooks/useSyncedState", () => ({
  useSyncedState: syncMocks.useSyncedState,
}));

import { useBombermanRoomSession } from "../useBombermanRoomSession";

function SessionHarness(): JSX.Element {
  const session = useBombermanRoomSession({ id: "room-reload" });
  return (
    <>
      <output data-testid="phase">{session.phase()}</output>
      <output data-testid="self-status">{session.selfStatus()}</output>
      <output data-testid="showing-game-ui">{String(session.showingGameUI())}</output>
    </>
  );
}

describe("useBombermanRoomSession reconnect lifecycle", () => {
  beforeEach(() => {
    syncMocks.calls.length = 0;
    vi.stubGlobal("fetch", async () => ({
      json: async () => ({
        success: true,
        data: {
          playerId: "player-1",
          phase: "between_rounds",
          role: "player",
          domains: { primary: "room-reload", game: "game-reload", chat: "chat-reload" },
        },
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows between-rounds UI state after reload before game sync exists", async () => {
    render(() => <SessionHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("between_rounds");
    });

    expect(screen.getByTestId("self-status")).toHaveTextContent("playing");
    expect(screen.getByTestId("showing-game-ui")).toHaveTextContent("true");
    expect(syncMocks.calls).toHaveLength(2);
    expect(syncMocks.calls[0]?.handle.connect).toHaveBeenCalledTimes(1);
    expect(syncMocks.calls[1]?.handle.connect).not.toHaveBeenCalled();
    expect(syncMocks.calls[1]?.handle.state()).toBeNull();
  });
});
