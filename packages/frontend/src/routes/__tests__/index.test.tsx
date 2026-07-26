import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@solidjs/testing-library";

vi.mock("@solidjs/meta", () => ({ Title: () => null, Meta: () => null }));
vi.mock("~/components/Hero", () => ({
  default: () => <div data-testid="hero" />,
}));

vi.mock("~/components/GameCard", () => ({
  default: () => <div data-testid="game-card" />,
}));

vi.mock("~/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "1", username: "test", displayName: "Test" },
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));


import Home from "../index";

describe("Home route", () => {
  it("assembles hero, games, cards, and footer", () => {
    render(() => <Home />);
    expect(screen.getByTestId("hero")).toBeInTheDocument();
    expect(screen.getByText("GAMES")).toBeInTheDocument();
    expect(screen.getAllByTestId("game-card")).toHaveLength(2);
    expect(screen.getByText(/Float's Games.*Online Multiplayer Games/)).toBeInTheDocument();
  });
});
