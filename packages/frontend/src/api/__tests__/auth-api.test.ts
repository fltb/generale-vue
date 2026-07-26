import { describe, it, expect, vi, beforeEach } from "vitest";
import { meApi, loginApi, registerApi, logoutApi, verifyApi, patchProfileApi } from "../auth";
import { jsonResponse } from "../../__tests__/helpers/jsonResponse";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("meApi", () => {
  it("GET /api/me", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: { id: "u1", username: "alice" } })));
    const res = await meApi();
    expect(res.user.id).toBe("u1");
  });
});

describe("loginApi", () => {
  it("POST /api/login with payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: { id: "u1" } })));
    const res = await loginApi({ username: "alice", password: "pass" });
    expect(res.user.id).toBe("u1");
  });
});

describe("registerApi", () => {
  it("POST /api/register", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "registered" })));
    const res = await registerApi({ username: "bob", password: "pass", email: "b@b.com" });
    expect(res.message).toBe("registered");
  });
});

describe("logoutApi", () => {
  it("POST /api/logout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ok: true })));
    const res = await logoutApi();
    expect(res.ok).toBe(true);
  });
});

describe("verifyApi", () => {
  it("POST /api/verify", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "verified" })));
    const res = await verifyApi({ token: "abc" });
    expect(res.message).toBe("verified");
  });
});

describe("patchProfileApi", () => {
  it("PATCH /api/me", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: { id: "u1", email: "new@b.com" } })));
    const res = await patchProfileApi({ email: "new@b.com" });
    expect(res.user.email).toBe("new@b.com");
  });
});
