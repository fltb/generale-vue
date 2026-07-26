import { describe, it, expect, vi, beforeEach } from "vitest";
import { forgotPasswordApi, resetPasswordApi, changePasswordApi, changeEmailApi, confirmEmailChangeApi, changeUsernameApi } from "../accountApi";
import { jsonResponse } from "../../__tests__/helpers/jsonResponse";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("accountApi", () => {
  it("forgotPasswordApi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "email sent" })));
    const res = await forgotPasswordApi({ email: "a@b.com" });
    expect(res.message).toBe("email sent");
  });

  it("resetPasswordApi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, valid: true })));
    const res = await resetPasswordApi({ token: "t", newPassword: "new" });
    expect(res.valid).toBe(true);
  });

  it("changePasswordApi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "changed" })));
    const res = await changePasswordApi({ currentPassword: "old", newPassword: "new" });
    expect(res.message).toBe("changed");
  });

  it("changeEmailApi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "confirmation sent" })));
    const res = await changeEmailApi({ newEmail: "new@b.com", currentPassword: "pass" });
    expect(res.message).toBe("confirmation sent");
  });

  it("confirmEmailChangeApi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "email changed" })));
    const res = await confirmEmailChangeApi({ token: "abc" });
    expect(res.message).toBe("email changed");
  });

  it("changeUsernameApi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ username: "newname" })));
    const res = await changeUsernameApi({ username: "newname" });
    expect(res.username).toBe("newname");
  });
});
