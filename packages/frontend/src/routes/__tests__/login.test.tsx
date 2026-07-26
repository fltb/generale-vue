import { describe, it, expect, vi } from "vitest";
import type { JSX } from "solid-js";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/meta", () => ({ Title: () => null, Meta: () => null }));

vi.mock("~/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
  A: (p: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={p.href}>{p.children}</a>,
}));

import LoginPage from "../login";

describe("Login route", () => {
  it("renders heading", () => {
    render(() => <LoginPage />);
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders login form by default", () => {
    render(() => <LoginPage />);
    expect(screen.getByTestId("login-username")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
    expect(screen.getByTestId("login-submit")).toBeInTheDocument();
  });

  it("renders tab switcher", () => {
    render(() => <LoginPage />);
    expect(screen.getAllByText("Login")).toHaveLength(2);
    expect(screen.getByText("Register")).toBeInTheDocument();
  });
});
