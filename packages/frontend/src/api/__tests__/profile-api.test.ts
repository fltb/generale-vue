import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProfileApi, patchMyProfileApi } from "../profileApi";
import { jsonResponse } from "../../__tests__/helpers/jsonResponse";

beforeEach(() => vi.restoreAllMocks());

describe("getProfileApi", () => {
  it("GET /api/profile/:userId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ userId: "u1", username: "alice" })));
    const res = await getProfileApi("u1");
    expect(res.username).toBe("alice");
  });
});

describe("patchMyProfileApi", () => {
  it("PATCH /api/profile/me", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Profile updated" })));
    const res = await patchMyProfileApi({ bio: "Hello" });
    expect(res.message).toBe("Profile updated");
  });
});
