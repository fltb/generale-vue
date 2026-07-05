import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { HUD } from "../HUD";

describe("HUD", () => {
  it("renders time in mm:ss format", () => {
    render(() => <HUD timeLeft={125} aliveCount={2} totalPlayers={4} />);
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("renders alive count", () => {
    render(() => <HUD timeLeft={0} aliveCount={1} totalPlayers={4} />);
    expect(screen.getByText("Alive: 1/4")).toBeInTheDocument();
  });

  it("renders zero time as 0:00", () => {
    render(() => <HUD timeLeft={0} aliveCount={4} totalPlayers={4} />);
    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  it("shows player stats when provided", () => {
    render(() => (
      <HUD
        timeLeft={100}
        aliveCount={2}
        totalPlayers={4}
        playerStats={{ bombMax: 3, bombActive: 1, blastRadius: 2, speed: 1 }}
      />
    ));
    expect(screen.getByText("Bombs: 1/3")).toBeInTheDocument();
    expect(screen.getByText("Fire: 2")).toBeInTheDocument();
    expect(screen.getByText("Speed: 1")).toBeInTheDocument();
  });

  it("shows active items with badges", () => {
    render(() => (
      <HUD
        timeLeft={100}
        aliveCount={2}
        totalPlayers={4}
        playerStats={{ bombMax: 2, bombActive: 1, blastRadius: 1, speed: 1 }}
        playerItems={["KICK", "REMOTE"]}
      />
    ));
    expect(screen.getByText("Kick")).toBeInTheDocument();
    expect(screen.getByText("Rmte")).toBeInTheDocument();
  });

  it("hides inventory when no stats provided", () => {
    render(() => <HUD timeLeft={0} aliveCount={1} totalPlayers={4} />);
    expect(screen.queryByText("Bombs:")).not.toBeInTheDocument();
    expect(screen.queryByText("Fire:")).not.toBeInTheDocument();
  });
});
