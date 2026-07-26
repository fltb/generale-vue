import { describe, it, expect, vi } from "vitest";
import type { JSX } from "solid-js";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/meta", () => ({ Title: () => null, Meta: () => null }));

const mockMutate = vi.fn();

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [() => ({ token: "verify-token" }), vi.fn()],
  A: (p: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={p.href}>{p.children}</a>,
}));

vi.mock("@tanstack/solid-query", () => ({
  useMutation: () => ({
    mutate: mockMutate,
    isPending: false,
    isSuccess: false,
    isError: false,
    data: undefined,
    error: null,
  }),
}));

vi.mock("~/hooks/useAuth", () => ({
  useAuth: () => ({
    verify: vi.fn(),
  }),
}));

import VerifyEmailPage from "../verify-email";

describe("VerifyEmail route", () => {
  it("renders heading", () => {
    render(() => <VerifyEmailPage />);
    expect(screen.getByText("Verify your email address")).toBeInTheDocument();
  });
});
