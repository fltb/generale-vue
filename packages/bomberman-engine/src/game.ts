import type {
  BombermanState,
  BombermanPlayer,
  BombermanOperation,
  BombermanConfig,
  BombermanMapDefinition,
  BombermanInputIndicator,
  BombermanEvent,
  ItemType,
  PlayerId,
  TeamId,
} from "@generale/types";
import { GameStatus } from "@generale/types";

import type { BombermanRandom } from "./random.js";
import { pushEvent } from "./events.js";

// ─── Public types ───

export interface BombermanGameOptions {
  config: BombermanConfig;
  seed: number;
  map: BombermanMapDefinition;
  players: Array<{
    id: PlayerId;
    name: string;
    teamId: TeamId;
    isBot: boolean;
    skinId: string;
  }>;
}

export interface TickResult {
  state: BombermanState;
  remainingOps: Record<PlayerId, BombermanOperation[]>;
}

// ─── Internal constant tables ───

const ITEM_DROP_TABLE: { type: ItemType; weight: number }[] = [
  { type: "BOMB_UP", weight: 10 },
  { type: "FIRE_UP", weight: 10 },
  { type: "SPEED_UP", weight: 10 },
  { type: "KICK", weight: 4 },
  { type: "GLOVE", weight: 3 },
  { type: "PUNCH", weight: 3 },
  { type: "REMOTE", weight: 2 },
  { type: "PIERCE", weight: 2 },
  { type: "SPIRIT", weight: 1 },
];


const DIRS: Record<string, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// ─── PRNG helpers ───

/** Pull a random float from the state's embedded PRNG, mutating rngState. */
function randomFromState(state: BombermanState): number {
  let s = state.rngState;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  state.rngState = s;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function weightedRandom(table: { type: ItemType; weight: number }[], state: BombermanState): ItemType {
  const total = table.reduce((s, i) => s + i.weight, 0);
  let r = randomFromState(state) * total;
  for (const item of table) {
    r -= item.weight;
    if (r <= 0) return item.type;
  }
  return table[0]?.type ?? "BOMB_UP";
}

// ─── State construction ───

/** Initialize the PRNG state from a seed (one Mulberry32 round). */
function initRngState(seed: number): number {
  let s = seed | 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return s;
}

export function createInitialBombermanState(options: BombermanGameOptions): BombermanState {
  const rngState = initRngState(options.seed);

  const players: Record<string, BombermanPlayer> = {};
  const inputIndicators: Record<string, BombermanInputIndicator> = {};

  for (let i = 0; i < options.players.length; i++) {
    const p = options.players[i]!;
    const spawn = options.map.spawns[i] ?? { x: 1, y: 1 };

    players[p.id] = {
      playerId: p.id,
      name: p.name,
      alive: true,
      x: spawn.x,
      y: spawn.y,
      bombMax: options.config.bombLimit,
      bombActive: 0,
      blastRadius: options.config.blastRadius,
      speed: 1,
      items: [],
      facing: "down",
      teamId: p.teamId,
      isBot: p.isBot,
      skinId: p.skinId,
    };

    inputIndicators[p.id] = {
      direction: null,
      action: null,
      actionTick: null,
    };
  }

  const state: BombermanState = {
    status: GameStatus.Playing,
    tick: 0,
    map: options.map,
    players: players as Record<PlayerId, BombermanPlayer>,
    bombs: [],
    explosions: [],
    items: [...options.map.fixedItems],
    config: options.config,
    bombIdCounter: 0,
    rngState,
    eventCounter: 0,
    events: [],
    inputIndicators: inputIndicators as Record<PlayerId, BombermanInputIndicator>,
    roundTimer: options.config.roundTimeSec > 0 ? options.config.roundTimeSec * options.config.tickRate : undefined,
    shrinkBoundary: 0,
  };

  return state;
}

// ─── Internal game helpers ───

function genBombId(s: BombermanState): string {
  const id = s.bombIdCounter ?? 0;
  s.bombIdCounter = id + 1;
  return `bomb_${id}`;
}

function hasBombAt(state: BombermanState, x: number, y: number): boolean {
  return state.bombs.some((b) => b.x === x && b.y === y);
}

function moveOneTile(
  player: BombermanPlayer,
  direction: string,
  state: BombermanState,
): { moved: boolean; kicked: boolean } {
  const d = DIRS[direction];
  if (!d) return { moved: false, kicked: false };
  const nx = player.x + d.dx;
  const ny = player.y + d.dy;

  const tile = state.map.tiles[ny]?.[nx];
  if (!tile || tile.type === "hard_wall" || tile.type === "soft_wall") {
    return { moved: false, kicked: false };
  }

  for (const [, p] of Object.entries(state.players)) {
    if (p.alive && p.playerId !== player.playerId && p.x === nx && p.y === ny) {
      return { moved: false, kicked: false };
    }
  }

  if (hasBombAt(state, nx, ny)) {
    const hasSpirit = player.items.includes("SPIRIT");
    if (hasSpirit) {
      // walk through bombs ghost-style
    } else if (player.items.includes("KICK")) {
      kickBomb(state, nx, ny, d.dx, d.dy);
    } else {
      return { moved: false, kicked: false };
    }
  }

  player.x = nx;
  player.y = ny;
  pickupItem(player, state, nx, ny);

  return { moved: true, kicked: false };
}

function kickBomb(state: BombermanState, bx: number, by: number, dx: number, dy: number): void {
  const bomb = state.bombs.find((b) => b.x === bx && b.y === by);
  if (!bomb) return;

  let tx = bx + dx;
  let ty = by + dy;

  while (true) {
    const tile = state.map.tiles[ty]?.[tx];
    if (!tile || tile.type === "hard_wall" || tile.type === "soft_wall") break;
    if (hasBombAt(state, tx, ty)) break;
    for (const [, p] of Object.entries(state.players)) {
      if (p.alive && p.playerId !== bomb.playerId && p.x === tx && p.y === ty) {
        p.alive = false;
        for (const item of p.items) {
          if (!["BOMB_UP", "FIRE_UP", "SPEED_UP"].includes(item)) {
            state.items.push({ x: tx, y: ty, type: item });
          }
        }
        p.items = [];
      }
    }
    tx += dx;
    ty += dy;
  }

  const finalX = tx - dx;
  const finalY = ty - dy;
  if (finalX !== bx || finalY !== by) {
    bomb.x = finalX;
    bomb.y = finalY;
  }
}

function pickupItem(player: BombermanPlayer, state: BombermanState, x: number, y: number): void {
  const itemIdx = state.items.findIndex((i) => i.x === x && i.y === y);
  if (itemIdx < 0) return;
  const item = state.items[itemIdx]!;
  state.items.splice(itemIdx, 1);

  if (item.type === "BOMB_UP") player.bombMax++;
  else if (item.type === "FIRE_UP") player.blastRadius++;
  else if (item.type === "SPEED_UP") player.speed++;
  else player.items.push(item.type);

  const rec = pushEvent(state.events, state.eventCounter, state.tick, {
    type: "item_picked_up",
    playerId: player.playerId,
    item: item.type,
  });
  state.events = rec.events;
  state.eventCounter = rec.eventCounter;
}

function placeBomb(player: BombermanPlayer, state: BombermanState): void {
  if (player.bombActive >= player.bombMax) return;
  if (hasBombAt(state, player.x, player.y)) return;
  const bombId = genBombId(state);
  state.bombs.push({
    id: bombId,
    playerId: player.playerId,
    x: player.x,
    y: player.y,
    fuse: state.config.bombFuse,
    blastRadius: player.blastRadius,
  });
  player.bombActive++;
}

function explode(bomb: BombermanState["bombs"][number], state: BombermanState, pierce: boolean): void {
  const dirs = [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const dir of dirs) {
    for (let r = 0; r <= bomb.blastRadius; r++) {
      const x = bomb.x + dir.dx * r;
      const y = bomb.y + dir.dy * r;
      const tile = state.map.tiles[y]?.[x];
      if (!tile) break;

      state.explosions.push({ x, y, ttl: 8, bombId: bomb.id, ownerId: bomb.playerId });

      for (const other of state.bombs) {
        if (other.id !== bomb.id && other.x === x && other.y === y && other.fuse > 0) {
          other.fuse = 0;
          const rec = pushEvent(state.events, state.eventCounter, state.tick, {
            type: "chain_triggered",
            sourceBombId: bomb.id,
            triggeredBombId: other.id,
            ownerId: bomb.playerId,
          });
          state.events = rec.events;
          state.eventCounter = rec.eventCounter;
        }
      }

      for (const [, player] of Object.entries(state.players)) {
        if (player.alive && player.x === x && player.y === y) {
          player.alive = false;

          if (player.carriedBomb && state.carriedBombs) {
            const carried = state.carriedBombs[player.playerId];
            if (carried) {
              carried.x = player.x;
              carried.y = player.y;
              carried.airborne = false;
              state.bombs.push(carried);
              delete state.carriedBombs[player.playerId];
            }
            delete player.carriedBomb;
          }
          for (const item of player.items) {
            if (!["BOMB_UP", "FIRE_UP", "SPEED_UP"].includes(item)) {
              state.items.push({ x, y, type: item });
            }
          }
          player.items = [];

          const rec = pushEvent(state.events, state.eventCounter, state.tick, {
            type: "elimination",
            victimId: player.playerId,
            killerId: bomb.playerId,
            bombId: bomb.id,
            cause: "bomb",
          });
          state.events = rec.events;
          state.eventCounter = rec.eventCounter;
        }
      }

      if (tile.type === "hard_wall") break;
      if (tile.type === "soft_wall") {
        tile.type = "empty";
        if (randomFromState(state) < state.config.itemDropRate) {
          let dropTable = ITEM_DROP_TABLE;
          if (state.config.items !== undefined) {
            const allowed = ITEM_DROP_TABLE.filter((i) => state.config.items.includes(i.type));
            dropTable = allowed;
          }
          if (dropTable.length > 0) {
            const dropType = weightedRandom(dropTable, state);
            state.items.push({ x, y, type: dropType as any });
            const rec2 = pushEvent(state.events, state.eventCounter, state.tick, {
              type: "item_spawned",
              item: { x, y, type: dropType as any },
            });
            state.events = rec2.events;
            state.eventCounter = rec2.eventCounter;
          }
        }
        if (!pierce) break;
      }

      if (dir.dx === 0 && dir.dy === 0) break;
    }
  }
}

function processExplosions(state: BombermanState): void {
  const exploded = new Set<string>();
  let toProcess = state.bombs.filter((b) => b.fuse <= 0);

  while (toProcess.length > 0) {
    const batch = toProcess;
    toProcess = [];
    for (const bomb of batch) {
      if (exploded.has(bomb.id)) continue;
      exploded.add(bomb.id);
      const hasPierce = Object.values(state.players).some(
        (p) => p.playerId === bomb.playerId && p.items.includes("PIERCE"),
      );
      explode(bomb, state, hasPierce);
    }
    toProcess = state.bombs.filter((b) => b.fuse <= 0 && !exploded.has(b.id));
  }

  state.bombs = state.bombs.filter((b) => !exploded.has(b.id));
}

function killOutOfBounds(state: BombermanState): void {
  const b = state.shrinkBoundary ?? 0;
  if (b <= 0) return;
  for (const [, player] of Object.entries(state.players)) {
    if (
      player.alive &&
      (player.x < b || player.x >= state.map.width - b || player.y < b || player.y >= state.map.height - b)
    ) {
      player.alive = false;
      if (player.carriedBomb && state.carriedBombs) {
        const carried = state.carriedBombs[player.playerId];
        if (carried) {
          carried.x = player.x;
          carried.y = player.y;
          state.bombs.push(carried);
          delete state.carriedBombs[player.playerId];
        }
        delete player.carriedBomb;
      }

      const rec = pushEvent(state.events, state.eventCounter, state.tick, {
        type: "elimination",
        victimId: player.playerId,
        killerId: null,
        bombId: null,
        cause: "shrink",
      });
      state.events = rec.events;
      state.eventCounter = rec.eventCounter;
    }
  }
}

function handleAction(player: BombermanPlayer, state: BombermanState): void {
  if (player.carriedBomb) {
    throwCarriedBomb(player, state);
    return;
  }
  if (player.items.includes("GLOVE")) {
    const bombIdx = state.bombs.findIndex((b) => b.x === player.x && b.y === player.y);
    if (bombIdx >= 0) {
      const bomb = state.bombs[bombIdx]!;
      if (!state.carriedBombs) state.carriedBombs = {};
      state.carriedBombs[player.playerId] = bomb;
      player.carriedBomb = bomb.id;
      state.bombs.splice(bombIdx, 1);
      return;
    }
  }
  if (player.items.includes("PUNCH")) {
    const d = DIRS[player.facing];
    if (d) {
      const adjX = player.x + d.dx;
      const adjY = player.y + d.dy;
      const bombIdx = state.bombs.findIndex((b) => b.x === adjX && b.y === adjY);
      if (bombIdx >= 0) {
        punchBomb(state, bombIdx, d.dx, d.dy, adjX, adjY);
      }
    }
  }
}

function throwCarriedBomb(player: BombermanPlayer, state: BombermanState): void {
  if (!player.carriedBomb) return;
  const cbs = state.carriedBombs;
  if (!cbs) return;
  const bomb = cbs[player.playerId];
  if (!bomb) return;

  const d = DIRS[player.facing];
  if (!d) return;

  const fromX = player.x;
  const fromY = player.y;
  const THROW_DISTANCE = 3;
  let landed = false;

  for (let dist = THROW_DISTANCE; dist >= 1; dist--) {
    const lx = player.x + d.dx * dist;
    const ly = player.y + d.dy * dist;
    const tile = state.map.tiles[ly]?.[lx];
    if (!tile || tile.type === "hard_wall" || tile.type === "soft_wall") continue;
    if (hasBombAt(state, lx, ly)) continue;

    bomb.x = lx;
    bomb.y = ly;
    bomb.airborne = false;
    state.bombs.push(bomb);
    delete cbs[player.playerId];
    delete player.carriedBomb;
    landed = true;

    const rec = pushEvent(state.events, state.eventCounter, state.tick, {
      type: "bomb_thrown",
      playerId: player.playerId,
      bombId: bomb.id,
      from: { x: fromX, y: fromY },
      to: { x: lx, y: ly },
    });
    state.events = rec.events;
    state.eventCounter = rec.eventCounter;

    for (const [, p] of Object.entries(state.players)) {
      if (p.alive && p.playerId !== player.playerId && p.x === lx && p.y === ly) {
        p.alive = false;
        for (const item of p.items) {
          if (!["BOMB_UP", "FIRE_UP", "SPEED_UP"].includes(item)) {
            state.items.push({ x: lx, y: ly, type: item });
          }
        }
        p.items = [];

        const rec2 = pushEvent(state.events, state.eventCounter, state.tick, {
          type: "elimination",
          victimId: p.playerId,
          killerId: player.playerId,
          bombId: bomb.id,
          cause: "bomb",
        });
        state.events = rec2.events;
        state.eventCounter = rec2.eventCounter;
      }
    }
    break;
  }

  if (!landed) {
    bomb.x = player.x;
    bomb.y = player.y;
    bomb.airborne = false;
    if (!hasBombAt(state, player.x, player.y)) {
      state.bombs.push(bomb);
    }
    delete cbs[player.playerId];
    delete player.carriedBomb;
  }
}

function punchBomb(
  state: BombermanState,
  bombIdx: number,
  dx: number,
  dy: number,
  bombX: number,
  bombY: number,
): void {
  const bomb = state.bombs[bombIdx]!;
  state.bombs.splice(bombIdx, 1);

  const PUNCH_DISTANCE = 3;
  let landed = false;

  for (let dist = PUNCH_DISTANCE; dist >= 1; dist--) {
    const lx = bombX + dx * dist;
    const ly = bombY + dy * dist;
    const tile = state.map.tiles[ly]?.[lx];
    if (!tile || tile.type === "hard_wall" || tile.type === "soft_wall") continue;
    if (hasBombAt(state, lx, ly)) continue;

    bomb.x = lx;
    bomb.y = ly;
    bomb.airborne = false;
    state.bombs.push(bomb);
    landed = true;

    for (const [, p] of Object.entries(state.players)) {
      if (p.alive && p.x === lx && p.y === ly) {
        p.alive = false;
        for (const item of p.items) {
          if (!["BOMB_UP", "FIRE_UP", "SPEED_UP"].includes(item)) {
            state.items.push({ x: lx, y: ly, type: item });
          }
        }
        p.items = [];

        const rec = pushEvent(state.events, state.eventCounter, state.tick, {
          type: "elimination",
          victimId: p.playerId,
          killerId: bomb.playerId,
          bombId: bomb.id,
          cause: "bomb",
        });
        state.events = rec.events;
        state.eventCounter = rec.eventCounter;
      }
    }
    break;
  }

  if (!landed) {
    bomb.x = bombX;
    bomb.y = bombY;
    state.bombs.push(bomb);
  }
}

// ─── Update input indicators from the canonical queue ───

function updateInputIndicators(state: BombermanState, queues: Record<string, BombermanOperation[]>): void {
  for (const [pid, ops] of Object.entries(queues)) {
    const indicator = state.inputIndicators[pid as PlayerId];
    if (!indicator) continue;

    indicator.direction = null;

    for (const op of ops) {
      if (op.type === "MOVE" || op.type === "SET_DIRECTION") {
        indicator.direction = op.direction ?? null;
      }
    }

    for (let i = ops.length - 1; i >= 0; i--) {
      const op = ops[i]!;
      if (op.type === "PLACE_BOMB" || op.type === "ACTION" || op.type === "DETONATE" || op.type === "SURRENDER") {
        indicator.action = op.type;
        indicator.actionTick = state.tick;
        break;
      }
    }
  }

  for (const indicator of Object.values(state.inputIndicators)) {
    if (indicator.actionTick !== null && state.tick - indicator.actionTick > 10) {
      indicator.action = null;
      indicator.actionTick = null;
    }
  }
}

// ─── Main tick ───

export function tick(
  state: BombermanState,
  queues: Record<PlayerId, BombermanOperation[]>,
): TickResult {
  const next = structuredClone(state) as BombermanState;
  next.tick++;

  if (next.bombIdCounter === undefined) next.bombIdCounter = state.bombIdCounter ?? 0;

  const remainingOps: Record<PlayerId, BombermanOperation[]> = {};

  for (const [pid, ops] of Object.entries(queues)) {
    const player = next.players[pid as PlayerId];
    if (!player?.alive) {
      remainingOps[pid as PlayerId] = [];
      continue;
    }
    if (ops.length === 0) {
      remainingOps[pid as PlayerId] = [];
      continue;
    }

    for (const op of ops) {
      switch (op.type) {
        case "SET_DIRECTION":
        case "MOVE": {
          const dir = op.direction ?? null;
          if (dir) {
            player.facing = dir;
            moveOneTile(player, dir, next);
          }
          break;
        }
        case "PLACE_BOMB":
          placeBomb(player, next);
          break;
        case "ACTION":
          handleAction(player, next);
          break;
        case "DETONATE": {
          const hasRemote = player.items.includes("REMOTE");
          if (!hasRemote) break;
          const remoteBombs = next.bombs.filter((b) => b.playerId === pid);
          if (remoteBombs.length > 0) {
            const first = remoteBombs[0]!;
            first.fuse = 0;
          }
          break;
        }
        case "SURRENDER": {
          player.alive = false;
          const rec = pushEvent(next.events, next.eventCounter, next.tick, {
            type: "elimination",
            victimId: pid as PlayerId,
            killerId: null,
            bombId: null,
            cause: "surrender",
          });
          next.events = rec.events;
          next.eventCounter = rec.eventCounter;
          break;
        }
      }
    }

    remainingOps[pid as PlayerId] = [];
  }

  updateInputIndicators(next, queues);

  for (const bomb of next.bombs) bomb.fuse--;

  if (next.carriedBombs) {
    for (const [pid, bomb] of Object.entries(next.carriedBombs)) {
      bomb.fuse--;
      if (bomb.fuse <= 0) {
        const carrier = next.players[pid as PlayerId];
        if (carrier?.alive) {
          bomb.x = carrier.x;
          bomb.y = carrier.y;
          next.bombs.push(bomb);
          delete next.carriedBombs[pid as PlayerId];
          if (next.players[pid as PlayerId]) delete next.players[pid as PlayerId].carriedBomb;
        }
      }
    }
  }

  processExplosions(next);

  for (const e of next.explosions) e.ttl--;
  next.explosions = next.explosions.filter((e) => e.ttl > 0);

  const bombCounts = new Map<PlayerId, number>();
  for (const bomb of next.bombs) {
    bombCounts.set(bomb.playerId, (bombCounts.get(bomb.playerId) ?? 0) + 1);
  }
  if (next.carriedBombs) {
    for (const [pid] of Object.entries(next.carriedBombs)) {
      bombCounts.set(pid as PlayerId, (bombCounts.get(pid as PlayerId) ?? 0) + 1);
    }
  }
  for (const [, p] of Object.entries(next.players)) {
    p.bombActive = bombCounts.get(p.playerId) ?? 0;
  }

  const aliveCount = Object.values(next.players).filter((p) => p.alive).length;
  if (aliveCount <= 1) {
    next.status = GameStatus.Ended;
  }

  if (next.config.roundTimeSec > 0) {
    if (next.roundTimer === undefined) next.roundTimer = next.config.roundTimeSec * next.config.tickRate;
    next.roundTimer = Math.max(0, next.roundTimer - 1);
    if (next.roundTimer === 0 && next.status !== GameStatus.Ended) {
      next.status = GameStatus.Ended;
    }
  }

  if (next.config.shrinkEnabled && next.roundTimer !== undefined) {
    const hurryThreshold = 30 * next.config.tickRate;
    if (next.roundTimer < hurryThreshold) {
      if (next.tick % next.config.tickRate === 0) {
        next.shrinkBoundary = (next.shrinkBoundary ?? 0) + 1;
      }
    }
  }

  killOutOfBounds(next);

  return { state: next, remainingOps };
}
