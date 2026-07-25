import { describe, it, expect } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import { Scoreboard } from "../Scoreboard";
import type { BombermanMatchState, BombermanMatchRanking } from "@generale/types";

describe("Scoreboard", () => {
  const players = [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" },
    { id: "p3", name: "Carol" },
  ];

  const match: BombermanMatchState = {
    format: "bo3",
    targetWins: 2,
    currentRound: 3,
    currentAttempt: 1,
    scores: [
      { competitor: { kind: "player", id: "p1" }, wins: 2 },
      { competitor: { kind: "player", id: "p2" }, wins: 0 },
    ],
    roundResults: [
      { roundNumber: 1, attempt: 1, winner: { kind: "player", id: "p1" }, reason: "last_alive", ticks: 500 },
      { roundNumber: 2, attempt: 1, winner: { kind: "player", id: "p1" }, reason: "last_alive", ticks: 450 },
    ],
    winner: { kind: "player", id: "p1" },
    nextRoundStartsAt: null,
  };

  const rankings: BombermanMatchRanking[] = [
    { competitor: { kind: "player", id: "p1" }, memberIds: ["p1"], wins: 2, rank: 1 },
    { competitor: { kind: "player", id: "p2" }, memberIds: ["p2"], wins: 0, rank: 2 },
    { competitor: { kind: "player", id: "p3" }, memberIds: ["p3"], wins: 0, rank: 2 },
  ];

  it("renders champion heading", () => {
    render(() => <Scoreboard match={match} rankings={rankings} players={players} onBackToRoom={() => {}} />);
    expect(screen.getByText("bomberman.matchChampion")).toBeInTheDocument();
  });

  it("renders back to room button", () => {
    render(() => <Scoreboard match={match} rankings={rankings} players={players} onBackToRoom={() => {}} />);
    expect(screen.getByText("bomberman.backToRoom")).toBeInTheDocument();
  });

  it("renders final score heading", () => {
    render(() => <Scoreboard match={match} rankings={rankings} players={players} onBackToRoom={() => {}} />);
    expect(screen.getByText("bomberman.finalScore")).toBeInTheDocument();
  });

  it("renders round results heading", () => {
    render(() => <Scoreboard match={match} rankings={rankings} players={players} onBackToRoom={() => {}} />);
    expect(screen.getByText("bomberman.roundResults")).toBeInTheDocument();
  });

  it("renders all rankings (uses getAllByText since names appear in multiple places)", () => {
    render(() => <Scoreboard match={match} rankings={rankings} players={players} onBackToRoom={() => {}} />);
    const aliceEls = screen.getAllByText((t) => t.includes("Alice"));
    expect(aliceEls.length).toBeGreaterThanOrEqual(1);
    const bobEls = screen.getAllByText((t) => t.includes("Bob"));
    expect(bobEls.length).toBeGreaterThanOrEqual(1);
    const carolEls = screen.getAllByText((t) => t.includes("Carol"));
    expect(carolEls.length).toBeGreaterThanOrEqual(1);
  });

  it("renders #1 and #2 rank labels", () => {
    render(() => <Scoreboard match={match} rankings={rankings} players={players} onBackToRoom={() => {}} />);
    const rank1Els = screen.getAllByText((t) => t.includes("#1"));
    expect(rank1Els.length).toBeGreaterThanOrEqual(1);
    const rank2Els = screen.getAllByText((t) => t.includes("#2"));
    expect(rank2Els.length).toBeGreaterThanOrEqual(2); // Bob and Carol both rank 2
  });

  it("handles draw (no winner)", () => {
    const drawMatch = { ...match, winner: null };
    render(() => <Scoreboard match={drawMatch} rankings={rankings} players={players} onBackToRoom={() => {}} />);
    expect(screen.getByText("bomberman.backToRoom")).toBeInTheDocument();
  });
});
