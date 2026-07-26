import { describe, it, expect, vi } from "vitest";
import type { AvatarProps } from "~/components/Avatar";
import type { UserProfileRespBody } from "@generale/types/dist/api";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/meta", () => ({ Title: () => null, Meta: () => null }));

const mockRefresh = vi.fn();

vi.mock("~/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "1",
      username: "testuser",
      displayName: "Test User",
      email: "test@example.com",
      bio: "Hello world",
    } satisfies UserProfileRespBody,
    isLoading: false,
    refresh: mockRefresh,
    logout: vi.fn(),
    login: vi.fn(),
  }),
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/solid-query", () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    data: undefined,
    error: null,
  }),
}));

vi.mock("~/api/accountApi", () => ({
  changeEmailApi: vi.fn(),
  changePasswordApi: vi.fn(),
  changeUsernameApi: vi.fn(),
}));

vi.mock("~/api/profileApi", () => ({
  patchMyProfileApi: vi.fn(),
  uploadMyAvatarApi: vi.fn(),
}));

vi.mock("~/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    settings: () => ({ locale: "en", theme: "system", soundMuted: false }),
    isLoading: () => false,
    update: vi.fn(),
  }),
}));

vi.mock("~/components/Avatar", () => ({
  default: (_props: AvatarProps) => <div data-testid="avatar">Avatar</div>,
}));

import ProfilePage from "../profile";

describe("Profile route", () => {
  it("renders profile heading", () => {
    render(() => <ProfilePage />);
    expect(screen.getAllByText("Profile").length).toBeGreaterThanOrEqual(1);
  });

  it("renders avatar section", () => {
    render(() => <ProfilePage />);
    expect(screen.getAllByText("Avatar").length).toBeGreaterThanOrEqual(1);
  });

  it("renders user email", () => {
    render(() => <ProfilePage />);
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    render(() => <ProfilePage />);
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });
});
