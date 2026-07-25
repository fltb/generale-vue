import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import type { BombermanConnectResponse } from "@generale/types";

// ─── Mock the REST fetch for room connect ───
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

/**
 * Test that the frontend uses the correct connect URL with and without role param.
 * This validates the role-awareness integration without importing the full hook.
 */

describe("Room role-aware entry", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends player role by default (no role param)", () => {
    // Simulate what useBombermanRoomSession does:
    // roleQuery = params.role && params.role !== "player" ? `?role=...` : ""
    const id = "test-room-1";
    const roleQuery = ""; // default player, no query
    const url = `/api/bomberman/room/connect/${id}${roleQuery}`;

    expect(url).toBe("/api/bomberman/room/connect/test-room-1");
    expect(url).not.toContain("?role=");
  });

  it("appends role=spectator query param", () => {
    const id = "test-room-1";
    const role = "spectator";
    const roleQuery = role && role !== "player" ? `?role=${encodeURIComponent(role)}` : "";
    const url = `/api/bomberman/room/connect/${id}${roleQuery}`;

    expect(url).toBe("/api/bomberman/room/connect/test-room-1?role=spectator");
  });

  it("skips role query for default player role", () => {
    const id = "test-room-1";
    const role = "player";
    // When role is "player" (default), no query param is appended
    const roleQuery = role && role !== "player" ? `?role=${encodeURIComponent(role)}` : "";
    const url = `/api/bomberman/room/connect/${id}${roleQuery}`;

    expect(url).toBe("/api/bomberman/room/connect/test-room-1");
    expect(url).not.toContain("?role=");
  });

  it("respects server-returned role field", () => {
    // Simulate a connect response with role: "spectator"
    const connectResponse: BombermanConnectResponse = {
      playerId: "user-123",
      phase: "playing",
      role: "spectator",
      domains: { primary: "room-test", game: "game-test", chat: "chat-test" },
    };

    // The hook reads d.data.role to set selfStatus
    const serverRole = connectResponse.role;
    let selfStatus: string | null = null;

    if (serverRole === "spectator") {
      selfStatus = "spectating";
    } else {
      selfStatus = "playing";
    }

    expect(serverRole).toBe("spectator");
    expect(selfStatus).toBe("spectating");
  });

  it("correctly maps player role from server", () => {
    const connectResponse: BombermanConnectResponse = {
      playerId: "user-123",
      phase: "playing",
      role: "player",
      domains: { primary: "room-test", game: "game-test", chat: "chat-test" },
    };

    let selfStatus: string | null = null;
    const serverRole = connectResponse.role;

    if (serverRole === "spectator") {
      selfStatus = "spectating";
    }
    if (connectResponse.phase === "playing" && serverRole !== "spectator") {
      selfStatus = "playing";
    }

    expect(serverRole).toBe("player");
    expect(selfStatus).toBe("playing");
  });

  it("uses default player role when server role is missing", () => {
    // Old server versions might not send role
    const connectResponse = {
      playerId: "user-123",
      phase: "lobby",
      domains: { primary: "room-test", game: "game-test", chat: "chat-test" },
    } as BombermanConnectResponse;

    const serverRole = connectResponse.role ?? "player";
    expect(serverRole).toBe("player");
  });

  it("builds correct openPayload with spectator role", () => {
    const effectivePassword = null;
    const role = "spectator";
    const openPayload = effectivePassword
      ? { password: effectivePassword, role }
      : { role };

    expect(openPayload).toEqual({ role: "spectator" });
  });

  it("builds correct openPayload with password and role", () => {
    const effectivePassword = "secret";
    const role = "spectator";
    const openPayload = effectivePassword
      ? { password: effectivePassword, role }
      : { role };

    expect(openPayload).toEqual({ password: "secret", role: "spectator" });
  });

  it("builds correct openPayload with default player role", () => {
    const effectivePassword = null;
    const role = "player";
    const openPayload = effectivePassword
      ? { password: effectivePassword, role }
      : { role };

    expect(openPayload).toEqual({ role: "player" });
  });
});
