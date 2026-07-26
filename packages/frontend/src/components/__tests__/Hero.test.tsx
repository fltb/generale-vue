import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import Hero from "../Hero";

describe("Hero", () => {
  it("renders the online-play heading, description, and scroll hint", () => {
    render(() => <Hero />);
    expect(screen.getByRole("heading", { name: "PLAY ONLINE" })).toBeInTheDocument();
    expect(screen.getByText(/Multiplayer games/)).toBeInTheDocument();
    expect(screen.getByText("▼")).toBeInTheDocument();
  });
});
