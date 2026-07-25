import { describe, it, expect } from "vitest";
import { BombermanGame } from "../instance/BombermanGame";
import { defaultBombermanConfig } from "../settings";
import { GameStatus, type BombermanConfig, type TeamId } from "@generale/types";
import { Mulberry32, generateBombermanMap } from "@generale/bomberman-engine";
import type { BombermanGameOptions } from "@generale/bomberman-engine";

function makeGameOptions(
  config: BombermanConfig,
  players: { id: string; name: string }[],
): BombermanGameOptions {
  const seed = 42;
  const rng = new Mulberry32(seed);
  const map = generateBombermanMap({
    width: config.mapWidth,
    height: config.mapHeight,
    themeId: "classic",
    softWallDensity: 0.55,
    random: rng,
  });
  return {
    config,
    seed,
    map,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      teamId: "team1" as TeamId,
      isBot: false,
      skinId: "classic-blue",
    })),
  };
}

describe("BombermanGame", () => {
  it("starts with GameStatus.Playing", () => {
    const config = defaultBombermanConfig();
    config.mapWidth = 9;
    config.mapHeight = 9;
    const game = new BombermanGame(makeGameOptions(config, [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }]));
    const state = game.getState();
    expect(state.status).toBe(GameStatus.Playing);
    expect(state.tick).toBe(0);
    game.destroy();
  });

  it("creates players at spawn positions", () => {
    const config = defaultBombermanConfig();
    config.mapWidth = 9;
    config.mapHeight = 9;
    const game = new BombermanGame(makeGameOptions(config, [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }]));
    const state = game.getState();
    expect(state.players.p1).toBeDefined();
    expect(state.players.p2).toBeDefined();
    expect(state.players.p1!.alive).toBe(true);
    expect(state.players.p2!.alive).toBe(true);
    game.destroy();
  });

  it("handles player actions through handleAction", () => {
    const game = new BombermanGame(makeGameOptions(defaultBombermanConfig(), [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }]));
    game.handleAction("p1", { type: "MOVE", direction: "right" });
    game.startTicking();
    // Wait a tick for processing
    const state = game.getState();
    // Player p1 should exist in state
    expect(state.players["p1"]).toBeDefined();
    expect(state.players["p1"].alive).toBe(true);
    game.stopTicking();
    game.destroy();
  });

  it("fires onEnd callback when game ends", () => {
    const game = new BombermanGame(makeGameOptions(defaultBombermanConfig(), [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }]));
    let endResult: { winnerId: string | null; state: unknown } | null = null;
    game.onEnd((result) => { endResult = result; });
    // Kill both players to trigger game end
    const state = game.getState();
    state.players["p1"].alive = false;
    state.players["p2"].alive = false;
    game.startTicking();
    // Game should end on next tick
    // Wait for tick to process
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(endResult).not.toBeNull();
        game.stopTicking();
        game.destroy();
        resolve();
      }, 200);
    });
  });

  it("destroys cleanly", () => {
    const config = defaultBombermanConfig();
    config.mapWidth = 9;
    config.mapHeight = 9;
    const game = new BombermanGame(makeGameOptions(config, [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }]));
    game.startTicking();
    game.destroy();
    // Should not throw
  });
});
