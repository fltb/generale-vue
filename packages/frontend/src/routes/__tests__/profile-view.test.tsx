import { describe, it, expect, vi } from "vitest";
import type { JSX } from "solid-js";
import type { ProfileRespBody } from "@generale/types/dist/api";
import type { AvatarProps } from "~/components/Avatar";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/meta", () => ({ Title: () => null, Meta: () => null }));

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ userId: "user-abc" }),
  useNavigate: () => vi.fn(),
  A: (p: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={p.href}>{p.children}</a>,
}));

vi.mock("@tanstack/solid-query", () => ({
  useQuery: () => ({
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: {
      userId: "user-abc",
      username: "someuser",
      displayName: "Some User",
      bio: "A bio",
      avatarUrl: "/avatar.png",
      avatarThumbUrl: "/avatar-thumb.png",
    } satisfies ProfileRespBody,
  }),
}));

vi.mock("~/api/profileApi", () => ({
  getProfileApi: vi.fn(),
}));

vi.mock("~/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "other-user", username: "me" },
    isLoading: false,
  }),
}));

vi.mock("~/components/Avatar", () => ({
  default: (_props: AvatarProps) => <div data-testid="avatar">Avatar</div>,
}));

import PublicProfilePage from "../profile-view";

describe("ProfileView route", () => {
  it("renders back button", () => {
    render(() => <PublicProfilePage />);
    expect(screen.getByText("← Back")).toBeInTheDocument();
  });

  it("renders user display name", () => {
    render(() => <PublicProfilePage />);
    expect(screen.getByText("Some User")).toBeInTheDocument();
  });

  it("renders user bio", () => {
    render(() => <PublicProfilePage />);
    expect(screen.getByText("A bio")).toBeInTheDocument();
  });
});
