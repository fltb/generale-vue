import type { BombermanPlayer, BombermanState, BombermanOperation, Bomb, ItemType, PlayerId } from "@generale/types";
import { GameStatus } from "@generale/types";

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

function genBombId(s: BombermanState): string {
  const id = s.bombIdCounter ?? 0;
  s.bombIdCounter = id + 1;
  return `bomb_${id}`;
}

function cloneState(state: BombermanState): BombermanState {
  return structuredClone(state);
}

function weightedRandom(table: { type: ItemType; weight: number }[]): ItemType {
  const total = table.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of table) {
    r -= item.weight;
    if (r <= 0) return item.type;
  }
  return table[0]?.type ?? "BOMB_UP";
}

function hasBombAt(state: BombermanState, x: number, y: number): boolean {
  return state.bombs.some((b) => b.x === x && b.y === y);
}

// ─── Per single-tile step: walk/kick/block ───

function moveOneTile(
  player: BombermanPlayer,
  direction: string,
  state: BombermanState,
): { moved: boolean; kicked: boolean } {
  const d = DIRS[direction];
  if (!d) return { moved: false, kicked: false };
  const nx = player.x + d.dx;
  const ny = player.y + d.dy;

  // 1. Map boundary / wall check
  const tile = state.map.tiles[ny]?.[nx];
  if (!tile || tile.type === "hard_wall" || tile.type === "soft_wall") {
    return { moved: false, kicked: false };
  }

  // 2. Other players: blocked
  for (const [, p] of Object.entries(state.players)) {
    if (p.alive && p.playerId !== player.playerId && p.x === nx && p.y === ny) {
      return { moved: false, kicked: false };
    }
  }

  // 3. Bomb blocking (unless SPIRIT or KICK)
  if (hasBombAt(state, nx, ny)) {
    const hasSpirit = player.items.includes("SPIRIT");
    if (hasSpirit) {
      // walk through bombs ghost-style
    } else if (player.items.includes("KICK")) {
      // kick the bomb forward, then step onto the tile
      kickBomb(state, nx, ny, d.dx, d.dy);
      // fall through to move
    } else {
      return { moved: false, kicked: false };
    }
  }

  // 4. Move + item pickup
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

  // Slide until wall or another bomb or map edge
  while (true) {
    const tile = state.map.tiles[ty]?.[tx];
    if (!tile || tile.type === "hard_wall" || tile.type === "soft_wall") break;
    if (hasBombAt(state, tx, ty)) break;
    // Kill players in path
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

  // Place bomb at final position (one step back from the wall)
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
  const item = state.items[itemIdx];
  if (!item) return;
  state.items.splice(itemIdx, 1);

  if (item.type === "BOMB_UP") player.bombMax++;
  else if (item.type === "FIRE_UP") player.blastRadius++;
  else if (item.type === "SPEED_UP") player.speed++;
  else player.items.push(item.type);
}

// ─── Place bomb ───

function placeBomb(player: BombermanPlayer, state: BombermanState): void {
  if (player.bombActive >= player.bombMax) return;
  if (hasBombAt(state, player.x, player.y)) return;
  state.bombs.push({
    id: genBombId(state),
    playerId: player.playerId,
    x: player.x,
    y: player.y,
    fuse: state.config.bombFuse,
    blastRadius: player.blastRadius,
  });
  player.bombActive++;
}

// ─── Explosion ───

function explode(bomb: Bomb, state: BombermanState, pierce: boolean): void {
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

      state.explosions.push({ x, y, ttl: 8 });

      // Chain-detonate bombs caught in the blast
      for (const other of state.bombs) {
        if (other.id !== bomb.id && other.x === x && other.y === y && other.fuse > 0) {
          other.fuse = 0;
        }
      }

      for (const [, player] of Object.entries(state.players)) {
        if (player.alive && player.x === x && player.y === y) {
          player.alive = false;
          // Drop carried bomb
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
        }
      }

      if (tile.type === "hard_wall") break;
      if (tile.type === "soft_wall") {
        tile.type = "empty";
        if (Math.random() < state.config.itemDropRate) {
          let dropTable = ITEM_DROP_TABLE;
          if (state.config.items !== undefined) {
            const allowed = ITEM_DROP_TABLE.filter((i) => state.config.items.includes(i.type));
            dropTable = allowed; // could be empty — means no items drop
          }
          if (dropTable.length > 0) {
            const dropType = weightedRandom(dropTable);
            state.items.push({ x, y, type: dropType });
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
  let toProcess: Bomb[] = state.bombs.filter((b) => b.fuse <= 0);

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
    // Re-check for chain-detonated bombs triggered during explosion
    toProcess = state.bombs.filter((b) => b.fuse <= 0 && !exploded.has(b.id));
  }

  state.bombs = state.bombs.filter((b) => !exploded.has(b.id));
}

// ─── Shrink / kill out of bounds ───

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
    }
  }
}

// ─── Unified ACTION: context-sensitive pickup/throw/punch ───

function handleAction(player: BombermanPlayer, state: BombermanState): void {
  // 1. If carrying a bomb → throw it
  if (player.carriedBomb) {
    throwCarriedBomb(player, state);
    return;
  }
  // 2. If has GLOVE and standing on a bomb → pick it up
  if (player.items.includes("GLOVE")) {
    const bombIdx = state.bombs.findIndex((b) => b.x === player.x && b.y === player.y);
    if (bombIdx >= 0) {
      const bomb = state.bombs[bombIdx];
      if (bomb) {
        if (!state.carriedBombs) state.carriedBombs = {};
        state.carriedBombs[player.playerId] = bomb;
        player.carriedBomb = bomb.id;
        state.bombs.splice(bombIdx, 1);
      }
      return;
    }
  }
  // 3. If has PUNCH and adjacent bomb in facing direction → punch it
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
  const carriedBombs = state.carriedBombs;
  if (!carriedBombs) return;
  const bomb = carriedBombs[player.playerId];
  if (!bomb) return;

  const d = DIRS[player.facing];
  if (!d) return;

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
    delete carriedBombs[player.playerId];
    delete player.carriedBomb;
    landed = true;

    // Kill player at landing tile
    for (const [, p] of Object.entries(state.players)) {
      if (p.alive && p.playerId !== player.playerId && p.x === lx && p.y === ly) {
        p.alive = false;
        for (const item of p.items) {
          if (!["BOMB_UP", "FIRE_UP", "SPEED_UP"].includes(item)) {
            state.items.push({ x: lx, y: ly, type: item });
          }
        }
        p.items = [];
      }
    }
    break;
  }

  if (!landed) {
    // Drop at thrower's feet
    bomb.x = player.x;
    bomb.y = player.y;
    bomb.airborne = false;
    if (!hasBombAt(state, player.x, player.y)) {
      state.bombs.push(bomb);
    }
    delete carriedBombs[player.playerId];
    delete player.carriedBomb;
  }
}

function punchBomb(state: BombermanState, bombIdx: number, dx: number, dy: number, bombX: number, bombY: number): void {
  const bomb = state.bombs[bombIdx];
  if (!bomb) return;
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

    // Kill player at landing
    for (const [, p] of Object.entries(state.players)) {
      if (p.alive && p.x === lx && p.y === ly) {
        p.alive = false;
        for (const item of p.items) {
          if (!["BOMB_UP", "FIRE_UP", "SPEED_UP"].includes(item)) {
            state.items.push({ x: lx, y: ly, type: item });
          }
        }
        p.items = [];
      }
    }
    break;
  }

  if (!landed) {
    // Bomb stays at original position
    bomb.x = bombX;
    bomb.y = bombY;
    state.bombs.push(bomb);
  }
}

// ─── Pure tick: transforms state + ops → new state + unconsumed ops ───

export type PlayerOps = BombermanOperation[];

export interface TickResult {
  state: BombermanState;
  remainingOps: Record<PlayerId, PlayerOps>;
}

export function tick(state: BombermanState, queues: Record<PlayerId, BombermanOperation[]>): TickResult {
  const next = cloneState(state);
  next.tick++;

  if (next.bombIdCounter === undefined) next.bombIdCounter = state.bombIdCounter ?? 0;

  const remainingOps: Record<string, PlayerOps> = {};

  for (const [pid, ops] of Object.entries(queues)) {
    const player = next.players[pid];
    if (!player?.alive) {
      remainingOps[pid] = [];
      continue;
    }
    if (ops.length === 0) {
      remainingOps[pid] = [];
      continue;
    }

    // Process ALL ops from the queue uniformly:
    //   SET_DIRECTION/MOVE → update direction, apply movement inline (makes one-shot actions at new pos)
    //   PLACE_BOMB/DETONATE/ACTION/SURRENDER → one-shot at current position
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
            const first = remoteBombs[0];
            if (first) first.fuse = 0;
          }
          break;
        }
        case "SURRENDER":
          player.alive = false;
          break;
        // NOOP and unknown types: consume without effect
      }
    }

    // All ops consumed — one-shot model (nothing remains unconsumed)
    remainingOps[pid] = [];
  }

  // Phase order: bombs → explosions → cleanup
  for (const bomb of next.bombs) bomb.fuse--;

  // Decrement carried bombs' fuse
  if (next.carriedBombs) {
    for (const [pid, bomb] of Object.entries(next.carriedBombs)) {
      bomb.fuse--;
      if (bomb.fuse <= 0) {
        // Bomb explodes at carrier's position
        const carrier = next.players[pid];
        if (carrier?.alive) {
          bomb.x = carrier.x;
          bomb.y = carrier.y;
          next.bombs.push(bomb);
          delete next.carriedBombs[pid];
          if (next.players[pid]) delete next.players[pid].carriedBomb;
        }
      }
    }
  }

  processExplosions(next);

  for (const e of next.explosions) e.ttl--;
  next.explosions = next.explosions.filter((e) => e.ttl > 0);

  // After explosions, count alive bombs for each player (bomb capacity tracking)
  const bombCounts = new Map<string, number>();
  for (const bomb of next.bombs) {
    bombCounts.set(bomb.playerId, (bombCounts.get(bomb.playerId) ?? 0) + 1);
  }
  // Also count carried bombs
  if (next.carriedBombs) {
    for (const [pid, _bomb] of Object.entries(next.carriedBombs)) {
      bombCounts.set(pid, (bombCounts.get(pid) ?? 0) + 1);
    }
  }
  for (const [, p] of Object.entries(next.players)) {
    p.bombActive = bombCounts.get(p.playerId) ?? 0;
  }

  // Check game end
  const aliveCount = Object.values(next.players).filter((p) => p.alive).length;
  if (aliveCount <= 1) {
    next.status = GameStatus.Ended;
  }

  // Round timer
  if (next.config.roundTimeSec > 0) {
    if (next.roundTimer === undefined) next.roundTimer = next.config.roundTimeSec * next.config.tickRate;
    next.roundTimer = Math.max(0, next.roundTimer - 1);
    if (next.roundTimer === 0 && next.status !== GameStatus.Ended) {
      next.status = GameStatus.Ended;
    }
  }

  // Sudden death: shrink boundary near end of round
  if (next.config.shrinkEnabled && next.roundTimer !== undefined) {
    const hurryThreshold = 30 * next.config.tickRate; // 30 seconds
    if (next.roundTimer < hurryThreshold) {
      if (next.tick % next.config.tickRate === 0) {
        next.shrinkBoundary = (next.shrinkBoundary ?? 0) + 1;
      }
    }
  }

  killOutOfBounds(next);

  return { state: next, remainingOps };
}
