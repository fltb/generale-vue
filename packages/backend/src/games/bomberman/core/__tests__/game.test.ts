import { describe, it, expect } from "vitest";
import { tick } from "../game";
import type { BombermanState, BombermanOperation } from "@generale/types";
import { GameStatus } from "@generale/types";

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
      p1: { playerId: "p1", name: "Alice", alive: true, x: 1, y: 1, bombMax: 1, bombActive: 0, blastRadius: 2, speed: 1, items: [] },
      p2: { playerId: "p2", name: "Bob", alive: true, x: 3, y: 3, bombMax: 1, bombActive: 0, blastRadius: 2, speed: 1, items: [] },
    },
    bombs: [],
    explosions: [],
    items: [],
    config: {
      mapWidth: 5, mapHeight: 5, playerLimit: 2, tickRate: 4,
      bombFuse: 3, bombLimit: 1, blastRadius: 2, roundTimeSec: 0,
      shrinkEnabled: false, itemDropRate: 0.6, items: ["BOMB_UP", "FIRE_UP"], mode: "multi",
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
    state.players.p1!.items = ["KICK" as any];
    state.bombs = [{ id: "b1", playerId: "p2", x: 2, y: 1, fuse: 5, blastRadius: 1 }];
    const result = tick(state, { p1: [{ type: "MOVE", direction: "right" }], p2: [] });
    // Player moves into the bomb tile, bomb gets kicked further right
    expect(result.players.p1!.x).toBe(2);
    const kickedBomb = result.bombs.find((b) => b.id === "b1");
    expect(kickedBomb!.x).toBeGreaterThan(2); // kicked away
  });

  it("SPIRIT item allows walking through bombs", () => {
    const state = makeBaseState();
    state.players.p1!.items = ["SPIRIT" as any];
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
