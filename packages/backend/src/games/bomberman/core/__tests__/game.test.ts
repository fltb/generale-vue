import { describe, it, expect } from "vitest";
import { tick } from "../game";
import type { BombermanState, BombermanOperation, ItemType } from "@generale/types";
import { GameStatus } from "@generale/types";
import { generateBombermanMap } from "../map-gen";

function makeBaseState(): BombermanState {
  return {
    status: GameStatus.Playing,
    tick: 0,
    map: {
      width: 5,
      height: 5,
      tiles: Array.from({ length: 5 }, () =>
        Array.from({ length: 5 }, () => ({ type: "empty" as const })),
      ),
    },
    players: {
      p1: { playerId: "p1", name: "Alice", alive: true, x: 1, y: 1, bombMax: 1, bombActive: 0, blastRadius: 2, speed: 1, items: [], facing: "down" },
      p2: { playerId: "p2", name: "Bob", alive: true, x: 3, y: 3, bombMax: 1, bombActive: 0, blastRadius: 2, speed: 1, items: [], facing: "down" },
    },
    bombs: [],
    explosions: [],
    items: [],
    config: {
      mapWidth: 5, mapHeight: 5, playerLimit: 2, tickRate: 4,
      bombFuse: 3, bombLimit: 1, blastRadius: 2, roundTimeSec: 0,
      shrinkEnabled: false, itemDropRate: 0.6, items: ["BOMB_UP", "FIRE_UP"],
    },
  };
}

describe("tick - player movement", () => {
  it("moves player in requested direction", () => {
    const state = makeBaseState();
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(2);
    expect(result.players.p1!.y).toBe(1);
  });

  it("blocks movement into hard walls", () => {
    const state = makeBaseState();
    state.map.tiles[1]![2] = { type: "hard_wall" };
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(1);
  });

  it("blocks movement into other players", () => {
    const state = makeBaseState();
    state.players.p2!.x = 2;
    state.players.p2!.y = 1;
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(1);
  });
});

describe("tick - bomb placement", () => {
  it("places bomb at player position", () => {
    const state = makeBaseState();
    const result = tick(state, { p1: [{ type: "PLACE_BOMB" }], p2: [] });
    expect(result.bombs).toHaveLength(1);
    expect(result.bombs[0]!.x).toBe(1);
    expect(result.bombs[0]!.y).toBe(1);
    expect(result.players.p1!.bombActive).toBe(1);
  });

  it("prevents placing bomb when at limit", () => {
    const state = makeBaseState();
    state.players.p1!.bombMax = 1;
    // Place a real bomb so bombActive reflects actual count
    state.bombs = [{ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 3, blastRadius: 2 }];
    const result = tick(state, { p1: [{ type: "PLACE_BOMB" }], p2: [] });
    expect(result.bombs).toHaveLength(1);
  });

  it("bomb places and active count reflects reality", () => {
    const state = makeBaseState();
    const result = tick(state, { p1: [{ type: "PLACE_BOMB" }], p2: [] });
    expect(result.bombs).toHaveLength(1);
    expect(result.players.p1!.bombActive).toBe(1);
  });

  it("bombActive recalc resets after bomb explodes", () => {
    const state = makeBaseState();
    state.bombs = [{ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 1, blastRadius: 2 }];
    const result = tick(state, { p1: [], p2: [] });
    expect(result.bombs).toHaveLength(0);
    expect(result.players.p1!.bombActive).toBe(0);
  });
});

describe("tick - bomb explosion", () => {
  it("bomb fuse decrements each tick", () => {
    const state = makeBaseState();
    state.bombs = [{ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 3, blastRadius: 2 }];
    const result = tick(state, { p1: [], p2: [] });
    expect(result.bombs[0]!.fuse).toBe(2);
  });

  it("kills player within explosion range", () => {
    const state = makeBaseState();
    state.bombs = [{ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 1, blastRadius: 2 }];
    state.players.p2!.x = 2;
    state.players.p2!.y = 1;
    const result = tick(state, { p1: [], p2: [] });
    expect(result.bombs).toHaveLength(0);
    expect(result.players.p2!.alive).toBe(false);
    expect(result.explosions.length).toBeGreaterThan(0);
  });

  it("destroys soft walls and drops items", () => {
    const state = makeBaseState();
    state.map.tiles[2]![1] = { type: "soft_wall" };
    state.bombs = [{ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 1, blastRadius: 2 }];
    const result = tick(state, { p1: [], p2: [] });
    const tile = result.map.tiles[2]?.[1];
    expect(tile?.type).toBe("empty");
  });

  it("ends game when only one player survives", () => {
    const state = makeBaseState();
    state.players.p2!.alive = false;
    const result = tick(state, { p1: [], p2: [] });
    expect(result.status).toBe(GameStatus.Ended);
  });
});

describe("tick - bomb blocking", () => {
  it("blocks movement into bomb tile", () => {
    const state = makeBaseState();
    state.bombs = [{ id: "b1", playerId: "p2", x: 2, y: 1, fuse: 5, blastRadius: 1 }];
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(1);
    expect(result.players.p1!.y).toBe(1);
  });

  it("KICK item allows kicking bombs instead of blocking", () => {
    const state = makeBaseState();
    state.players.p1!.items = ["KICK" as ItemType];
    // Place a hard wall 3 tiles away so bomb stops at x=3
    state.map.tiles[1]![4] = { type: "hard_wall" };
    state.bombs = [{ id: "b1", playerId: "p2", x: 2, y: 1, fuse: 5, blastRadius: 1 }];
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(2);
    const kickedBomb = result.bombs.find((b) => b.id === "b1");
    expect(kickedBomb).toBeDefined();
    expect(kickedBomb!.x).toBe(3); // kicked to wall at x=4, stops at x=3
  });

  it("SPIRIT item allows walking through bombs", () => {
    const state = makeBaseState();
    state.players.p1!.items = ["SPIRIT" as ItemType];
    state.bombs = [{ id: "b1", playerId: "p2", x: 2, y: 1, fuse: 5, blastRadius: 1 }];
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(2);
    expect(result.players.p1!.y).toBe(1);
    // Bomb stays put
    expect(result.bombs[0]!.x).toBe(2);
  });
});

describe("tick - speed stat", () => {
  it("speed=1 moves one tile per tick", () => {
    const state = makeBaseState();
    state.players.p1!.speed = 1;
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(2);
  });

  it("speed=2 moves two tiles per tick", () => {
    const state = makeBaseState();
    state.players.p1!.speed = 2;
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(3);
  });

  it("speed=2 stops at wall after first tile", () => {
    const state = makeBaseState();
    state.players.p1!.speed = 2;
    state.players.p1!.x = 2;
    state.players.p1!.y = 1;
    state.map.tiles[1]![4] = { type: "hard_wall" };
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(3); // stopped at wall before tile 4
  });
});

describe("tick - item pickup", () => {
  it("player picks up item when moving onto it", () => {
    const state = makeBaseState();
    state.items = [{ x: 2, y: 1, type: "BOMB_UP" }];
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.bombMax).toBe(2);
    expect(result.items).toHaveLength(0);
  });
});

describe("tick - round timer and shrink", () => {
  it("roundTimer decrements each tick", () => {
    const state = makeBaseState();
    state.config.roundTimeSec = 1;
    state.config.shrinkEnabled = true;
    const result = tick(state, { p1: [], p2: [] });
    expect((result as any).roundTimer).toBe(3);
  });

  it("round timer reaching 0 ends the game", () => {
    const state = makeBaseState();
    state.roundTimer = 1;
    state.config.roundTimeSec = 180; // > 0 so timer logic activates
    const result = tick(state, { p1: [], p2: [] });
    expect(result.roundTimer).toBe(0);
    expect(result.status).toBe(GameStatus.Ended);
  });

  it("sudden death: shrinkBoundary increments when timer < 30s", () => {
    const state = makeBaseState();
    state.config.shrinkEnabled = true;
    state.config.tickRate = 10;
    // Make map bigger so we have room for shrink
    state.config.mapWidth = 15;
    state.config.mapHeight = 13;
    state.roundTimer = 29 * 10; // 290 ticks (< 300 = 30s threshold)
    state.shrinkBoundary = 0;
    let result: BombermanState = state;
    for (let i = 0; i < 10; i++) {
      result = tick(result, { p1: [], p2: [] });
    }
    // After 10 ticks, tick % 10 === 0 once, so shrinkBoundary should be 1
    expect(result.shrinkBoundary).toBe(1);
  });
});

describe("tick - SURRENDER", () => {
  it("marks player as dead on surrender", () => {
    const state = makeBaseState();
    const result = tick(state, { p1: [{ type: "SURRENDER" }], p2: [] });
    expect(result.players.p1!.alive).toBe(false);
    expect(result.players.p2!.alive).toBe(true);
  });

  it("surrender triggers game end when only one player remains alive", () => {
    const state = makeBaseState();
    state.players.p1!.alive = false;
    state.players.p2!.x = 3;
    const result = tick(state, { p1: [{ type: "SURRENDER" }], p2: [{ type: "MOVE", direction: "left" }] });
    expect(result.players.p1!.alive).toBe(false);
    expect(result.status).toBe(GameStatus.Ended);
  });
});

describe("tick - continuous held-key movement", () => {
  it("same direction persists across multiple ticks", () => {
    const state = makeBaseState();
    // Player at (1,1). Move right 3 ticks in a row.
    let result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(2);
    result = tick(result, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(3);
    result = tick(result, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(4);
  });

  it("holding direction moves continuously tick after tick", () => {
    const state = makeBaseState();
    // Tick 1: move right
    let result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(2);
    // Tick 2: same direction, move again
    result = tick(result, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(3);
    // Tick 3
    result = tick(result, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(4);
  });

  it("speed=2 doubles movement per tick", () => {
    const state = makeBaseState();
    state.players.p1!.speed = 2;
    // Move right: should move 2 tiles
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    expect(result.players.p1!.x).toBe(3);
  });
});

describe("tick - game end and restart", () => {
  it("game properly ends and new game starts fresh", () => {
    const state = makeBaseState();
    // Kill p2 to end the game
    state.players.p2!.alive = false;
    const ended = tick(state, { p1: [], p2: [] });
    expect(ended.status).toBe(GameStatus.Ended);

    // Fresh state for restart: re-enable p2, new map
    const fresh = makeBaseState();
    fresh.players.p2!.alive = true;
    const restarted = tick(fresh, { p1: [], p2: [] });
    expect(restarted.status).toBe(GameStatus.Playing);
    expect(restarted.players.p2!.alive).toBe(true);
    expect(restarted.tick).toBe(1);
  });
});

describe("tick - ACTION mechanic (GLOVE/PUNCH)", () => {
  it("GLOVE: player picks up bomb with ACTION", () => {
    const state = makeBaseState();
    state.players.p1!.items.push("GLOVE" as ItemType);
    // Place a bomb at p1's position
    state.bombs.push({ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 3, blastRadius: 1 });
    state.players.p1!.bombActive = 1;
    const result = tick(state, { p1: [{ type: "ACTION" }], p2: [] });
    // Bomb should be removed from state.bombs
    expect(result.bombs.find((b) => b.id === "b1")).toBeUndefined();
    // Player should be carrying it
    expect(result.players.p1!.carriedBomb).toBe("b1");
    expect(result.carriedBombs?.["p1"]?.id).toBe("b1");
  });

  it("GLOVE: player throws carried bomb with ACTION", () => {
    const state = makeBaseState();
    state.players.p1!.items.push("GLOVE" as ItemType);
    state.players.p1!.facing = "right";
    state.players.p1!.carriedBomb = "b1";
    state.carriedBombs = {
      p1: { id: "b1", playerId: "p1", x: 1, y: 1, fuse: 3, blastRadius: 1 },
    };
    const result = tick(state, { p1: [{ type: "ACTION" }], p2: [] });
    // Bomb should be back on the board, up to 3 tiles to the right
    expect(result.players.p1!.carriedBomb).toBeUndefined();
    const bomb = result.bombs.find((b) => b.id === "b1");
    expect(bomb).toBeDefined();
    expect(bomb!.x).toBe(4); // furthest valid tile: 1+3=5 is OOB, lands at 4
    expect(bomb!.y).toBe(1);
  });

  it("PUNCH: player punches adjacent bomb forward", () => {
    const state = makeBaseState();
    state.players.p1!.items.push("PUNCH" as ItemType);
    state.players.p1!.facing = "right";
    // Place a bomb adjacent to p1 (p1 at 1,1, bomb at 2,1)
    state.bombs.push({ id: "b1", playerId: "p1", x: 2, y: 1, fuse: 3, blastRadius: 1 });
    const result = tick(state, { p1: [{ type: "ACTION" }], p2: [] });
    const bomb = result.bombs.find((b) => b.id === "b1");
    expect(bomb).toBeDefined();
    // Bomb should be punched forward — furthest valid tile in 5x5 map
    expect(bomb!.x).toBe(4); // (5,1) is OOB, stops at (4,1)
    expect(bomb!.y).toBe(1);
  });
});

describe("tick - DETONATE / REMOTE", () => {
  it("DETONATE: player with REMOTE detonates their bomb", () => {
    const state = makeBaseState();
    state.players.p1!.items.push("REMOTE" as ItemType);
    state.bombs.push({ id: "b1", playerId: "p1", x: 2, y: 2, fuse: 3, blastRadius: 1 });
    const result = tick(state, { p1: [{ type: "DETONATE" }], p2: [] });
    // Bomb should have been detonated (fuse set to 0, then tick decrements to -1, then explodes)
    expect(result.bombs.find((b) => b.id === "b1")).toBeUndefined();
    expect(result.explosions.length).toBeGreaterThan(0);
  });

  it("DETONATE: player without REMOTE cannot detonate", () => {
    const state = makeBaseState();
    state.bombs.push({ id: "b1", playerId: "p1", x: 2, y: 2, fuse: 3, blastRadius: 1 });
    const result = tick(state, { p1: [{ type: "DETONATE" }], p2: [] });
    // Bomb should still be there with fuse decremented by 1 from normal tick
    const bomb = result.bombs.find((b) => b.id === "b1");
    expect(bomb).toBeDefined();
    expect(bomb!.fuse).toBe(2); // 3 - 1 from normal tick decrement
  });
});

describe("tick - chain explosion", () => {
  it("chain explosion: bomb caught in blast detonates same tick", () => {
    const state = makeBaseState();
    // Two bombs: b1 at 1,1 with blastRadius 2, b2 at 3,1 within blast path
    state.bombs.push({ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 0, blastRadius: 2 });
    state.bombs.push({ id: "b2", playerId: "p2", x: 3, y: 1, fuse: 3, blastRadius: 1 });
    const result = tick(state, { p1: [], p2: [] });
    // Both bombs should be gone
    expect(result.bombs.find((b) => b.id === "b1")).toBeUndefined();
    expect(result.bombs.find((b) => b.id === "b2")).toBeUndefined();
    // Should have explosions from both
    expect(result.explosions.length).toBeGreaterThan(0);
  });
});

describe("tick - config.items filtering", () => {
  it("config.items filters the drop table to only allowed types", () => {
    const state = makeBaseState();
    state.config.items = ["BOMB_UP" as ItemType];
    state.config.itemDropRate = 1.0; // always drop
    // Place a soft wall at (2,1) — right of p1's position (1,1)
    state.map.tiles[1]![2] = { type: "soft_wall" };
    // Place a bomb at p1's position to destroy the soft wall
    state.bombs.push({ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 0, blastRadius: 2 });
    const result = tick(state, { p1: [], p2: [] });
    // Only BOMB_UP should be dropped at the soft wall position
    const droppedItems = result.items.filter((i) => i.x === 2 && i.y === 1);
    expect(droppedItems.length).toBeGreaterThan(0);
    for (const item of droppedItems) {
      expect(item.type).toBe("BOMB_UP");
    }
  });
});

describe("tick - carried bomb", () => {
  it("carried bomb drops at player position on death", () => {
    const state = makeBaseState();
    state.players.p1!.carriedBomb = "b1";
    state.players.p1!.facing = "down";
    state.carriedBombs = {
      p1: { id: "b1", playerId: "p1", x: 1, y: 1, fuse: 3, blastRadius: 1 },
    };
    // Place a bomb that will kill p1 (b2 at 1,2, blastRadius 2 covers p1 at 1,1)
    state.bombs.push({ id: "b2", playerId: "p2", x: 1, y: 2, fuse: 0, blastRadius: 2 });
    const result = tick(state, { p1: [], p2: [] });
    // p1 should be dead
    expect(result.players.p1!.alive).toBe(false);
    // Carried bomb should be dropped at p1's position
    expect(result.players.p1!.carriedBomb).toBeUndefined();
    const droppedBomb = result.bombs.find((b) => b.id === "b1");
    expect(droppedBomb).toBeDefined();
    expect(droppedBomb!.x).toBe(1);
    expect(droppedBomb!.y).toBe(1);
    // Carried bomb should be gone from carriedBombs
    expect(result.carriedBombs?.["p1"]).toBeUndefined();
  });

  it("carried bomb fuse decrements and explodes at carrier position", () => {
    const state = makeBaseState();
    state.players.p1!.carriedBomb = "b1";
    state.carriedBombs = {
      p1: { id: "b1", playerId: "p1", x: 1, y: 1, fuse: 1, blastRadius: 1 },
    };
    const result = tick(state, { p1: [], p2: [] });
    // p1 should be dead (carried bomb exploded at their position)
    expect(result.players.p1!.alive).toBe(false);
    expect(result.players.p1!.carriedBomb).toBeUndefined();
    // Carried bomb should be gone from carriedBombs and regular bombs
    expect(result.carriedBombs?.["p1"]).toBeUndefined();
    expect(result.bombs.find((b) => b.id === "b1")).toBeUndefined();
  });
});

describe("tick - PIERCE item", () => {
  it("explosion with PIERCE continues past soft walls and destroys them", () => {
    const state = makeBaseState();
    state.players.p1!.items.push("PIERCE" as ItemType);
    // Soft wall at (2,1) along blast path from (1,1)
    state.map.tiles[1]![2] = { type: "soft_wall" };
    // Place p2 at (3,1) behind the soft wall
    state.players.p2!.x = 3;
    state.players.p2!.y = 1;
    state.players.p2!.alive = true;
    // Bomb at p1's position
    state.bombs.push({ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 0, blastRadius: 5 });
    const result = tick(state, { p1: [], p2: [] });
    // Soft wall should be destroyed
    expect(result.map.tiles[1]![2].type).toBe("empty");
    // p2 behind the soft wall should be killed (blast pierces)
    expect(result.players.p2!.alive).toBe(false);
  });
});

describe("tick - draw resolution", () => {
  it("when all players die in the same tick, game ends with no winner", () => {
    const state = makeBaseState();
    // Bombs at both players' positions, both with fuse=0
    state.bombs.push({ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 0, blastRadius: 1 });
    state.bombs.push({ id: "b2", playerId: "p2", x: 3, y: 3, fuse: 0, blastRadius: 1 });
    const result = tick(state, { p1: [], p2: [] });
    expect(result.players.p1!.alive).toBe(false);
    expect(result.players.p2!.alive).toBe(false);
    expect(result.status).toBe(GameStatus.Ended);
  });
});

describe("tick - empty config.items", () => {
  it("empty items array means no items ever drop", () => {
    const state = makeBaseState();
    state.config.items = [];
    state.config.itemDropRate = 1.0; // always try to drop
    // Place a soft wall at (2,1)
    state.map.tiles[1]![2] = { type: "soft_wall" };
    state.bombs.push({ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 0, blastRadius: 2 });
    const beforeCount = state.items.length;
    const result = tick(state, { p1: [], p2: [] });
    // No new items should have been created
    expect(result.items.length).toBe(beforeCount);
  });
});

describe("tick - kill out of bounds", () => {
  it("killOutOfBounds kills player outside shrink boundary", () => {
    const state = makeBaseState();
    // Expand map to 15x13 so shrink boundary has room
    state.config.mapWidth = 15;
    state.config.mapHeight = 13;
    state.map.width = 15;
    state.map.height = 13;
    state.map.tiles = Array.from({ length: 13 }, () =>
      Array.from({ length: 15 }, () => ({ type: "empty" as const })),
    );
    state.shrinkBoundary = 3;
    // p1 at (1,1): x=1 < 3 → outside
    state.players.p1!.x = 1;
    state.players.p1!.y = 1;
    state.players.p1!.alive = true;
    // p2 at (7,7): well inside the 3-tile margin
    state.players.p2!.x = 7;
    state.players.p2!.y = 7;
    state.players.p2!.alive = true;
    const result = tick(state, { p1: [], p2: [] });
    // p1 should be dead from out-of-bounds
    expect(result.players.p1!.alive).toBe(false);
    // p2 should remain alive
    expect(result.players.p2!.alive).toBe(true);
  });
});

describe("tick - throw bomb kills on landing", () => {
  it("GLOVE: thrown bomb landing on another player kills them", () => {
    const state = makeBaseState();
    state.players.p1!.items.push("GLOVE" as ItemType);
    state.players.p1!.facing = "right";
    state.players.p1!.carriedBomb = "b1";
    state.carriedBombs = { p1: { id: "b1", playerId: "p1", x: 1, y: 1, fuse: 3, blastRadius: 1 } };
    // p2 at the expected landing position (4,1) — 3 tiles right from (1,1)
    state.players.p2!.x = 4;
    state.players.p2!.y = 1;
    state.players.p2!.alive = true;
    const result = tick(state, { p1: [{ type: "ACTION" }], p2: [] });
    // Bomb should land at (4,1) — 1+3=4 is furthest valid tile on 5-wide map
    const bomb = result.bombs.find((b) => b.id === "b1");
    expect(bomb).toBeDefined();
    expect(bomb!.x).toBe(4);
    expect(bomb!.y).toBe(1);
    // p2 should be dead from being at the landing position
    expect(result.players.p2!.alive).toBe(false);
  });
});

describe("tick - multi-chain explosion", () => {
  it("explosion chains through 3+ bombs in a row", () => {
    const state = makeBaseState();
    // b1 at (1,1) with blastRadius=2, b2 at (3,1) within blast, b3 at (4,1) within b2's blast
    state.bombs.push({ id: "b1", playerId: "p1", x: 1, y: 1, fuse: 0, blastRadius: 2 });
    state.bombs.push({ id: "b2", playerId: "p2", x: 3, y: 1, fuse: 5, blastRadius: 1 });
    state.bombs.push({ id: "b3", playerId: "p1", x: 4, y: 1, fuse: 5, blastRadius: 1 });
    const result = tick(state, { p1: [], p2: [] });
    // All 3 bombs should be chain-detonated
    expect(result.bombs.find((b) => b.id === "b1")).toBeUndefined();
    expect(result.bombs.find((b) => b.id === "b2")).toBeUndefined();
    expect(result.bombs.find((b) => b.id === "b3")).toBeUndefined();
    // Multiple explosion entries from all three bombs
    expect(result.explosions.length).toBeGreaterThan(0);
  });
});

describe("map-gen — variety", () => {
  it("two maps with same dimensions differ", () => {
    const map1 = generateBombermanMap(15, 13);
    const map2 = generateBombermanMap(15, 13);
    // Serialize and compare
    const s1 = JSON.stringify(map1.tiles);
    const s2 = JSON.stringify(map2.tiles);
    // With random soft wall removal, maps should almost always differ
    // (hard walls are fixed, only soft walls vary)
    expect(s1).not.toBe(s2);
  });
});
