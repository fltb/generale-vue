import type {
  BombermanState,
  BombermanDirection,
  BombermanOperation,
  BombermanBotDifficulty,
  Bomb,
} from "@generale/types";

// ─── Public types ───

export interface BombermanBotContext {
  playerId: string;
  difficulty: BombermanBotDifficulty;
  decisionTick: number;
  randomState: number;
}

export interface BombermanBotDecision {
  operation: BombermanOperation;
  expandedNodes: number;
  nextRandomState: number;
}

// ─── Internal constants ───

const DIRS: Array<{ dx: number; dy: number; name: BombermanDirection }> = [
  { dx: 0, dy: -1, name: "up" },
  { dx: 1, dy: 0, name: "right" },
  { dx: 0, dy: 1, name: "down" },
  { dx: -1, dy: 0, name: "left" },
];

const DIFFICULTY_CONFIG: Record<
  BombermanBotDifficulty,
  { decisionInterval: number; horizon: number; advancedFeatures: boolean }
> = {
  easy: { decisionInterval: 8, horizon: 10, advancedFeatures: false },
  normal: { decisionInterval: 4, horizon: 20, advancedFeatures: false },
  hard: { decisionInterval: 2, horizon: 30, advancedFeatures: true },
};

const MAX_EXPANDED_NODES = 256;

const CARDINAL_DIRS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

// ─── PRNG (Mulberry32, inline) ───

function mulberry32(state: number): number {
  const nextState = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(nextState ^ (nextState >>> 15), 1 | nextState);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seededRandomChoice<T>(items: T[], seed: number): { value: T; nextSeed: number } {
  if (items.length === 0) throw new Error("empty choice list");
  const r = mulberry32(seed);
  const idx = Math.floor(r * items.length);
  const value = items[idx];
  if (value === undefined) throw new Error("choice index out of bounds");
  return { value, nextSeed: ((seed + 1) | 0) >>> 0 };
}

// ─── Danger map ───

/**
 * Compute a time-expanded danger map.
 * Returns a Map from cellKey `x,y` → the earliest tickOffset at which
 * that cell becomes dangerous (explosion reaches it).
 * tickOffset is relative to the current tick (0 = now).
 */
function computeDangerMap(state: BombermanState, horizon: number): Map<string, number> {
  const danger = new Map<string, number>();
  const width = state.map.width;
  const height = state.map.height;

  // Helper: mark all cells in a bomb's blast as dangerous at a given tick
  const markBlast = (bomb: Bomb, tickOffset: number) => {
    // Bomb cell
    const bombKey = `${bomb.x},${bomb.y}`;
    const existing = danger.get(bombKey);
    if (existing === undefined || tickOffset < existing) {
      danger.set(bombKey, tickOffset);
    }

    const hasPierce = Object.values(state.players).some(
      (p) => p.playerId === bomb.playerId && p.items.includes("PIERCE"),
    );

    for (const dir of CARDINAL_DIRS) {
      let blocked = false;
      for (let dist = 1; dist <= bomb.blastRadius; dist++) {
        const cx = bomb.x + dir.dx * dist;
        const cy = bomb.y + dir.dy * dist;
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) break;

        const tile = state.map.tiles[cy]?.[cx];
        if (!tile || tile.type === "hard_wall") break;

        const cellKey = `${cx},${cy}`;
        const existing = danger.get(cellKey);
        if (existing === undefined || tickOffset < existing) {
          danger.set(cellKey, tickOffset);
        }

        if (!hasPierce && tile.type === "soft_wall") {
          blocked = true;
        }

        if (blocked) break;
      }
    }
  };

  // Process all current bombs
  for (const bomb of state.bombs) {
    // Don't process airborne bombs — they are in transit
    if (bomb.airborne) continue;
    const tickOffset = bomb.fuse;
    if (tickOffset > horizon) continue;
    markBlast(bomb, tickOffset);

    // Chain reactions: bombs caught in this blast also explode at same tick
    // Re-check after initial blast marking
    let changed = true;
    while (changed) {
      changed = false;
      for (const otherBomb of state.bombs) {
        if (otherBomb.airborne) continue;
        const otherKey = `${otherBomb.x},${otherBomb.y}`;
        const otherDanger = danger.get(otherKey);
        if (otherDanger !== undefined && otherDanger <= tickOffset && otherBomb.id !== bomb.id) {
          // This other bomb is in the blast — it also explodes at the same tick
          // Only process if we haven't already processed its blast at this tick
          const otherBlastExisting = danger.get(`chain:${otherBomb.id}:${tickOffset}`);
          if (!otherBlastExisting) {
            danger.set(`chain:${otherBomb.id}:${tickOffset}`, tickOffset);
            markBlast(otherBomb, tickOffset);
            changed = true;
          }
        }
      }
    }
  }

  return danger;
}

// ─── Escape path check ───

/**
 * Check if there is an escape route from (sx, sy) within `fuseTicks` ticks
 * after placing a bomb at (sx, sy). Returns true if a safe cell is reachable
 * within the fuse window.
 */
function hasEscapeRoute(
  state: BombermanState,
  sx: number,
  sy: number,
  fuseTicks: number,
  dangerMap: Map<string, number>,
): boolean {
  const width = state.map.width;
  const height = state.map.height;

  // BFS over (x, y, t) where t = ticks elapsed
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number; t: number }> = [{ x: sx, y: sy, t: 0 }];
  visited.add(`${sx},${sy},0`);

  for (let qi = 0; qi < queue.length && qi < MAX_EXPANDED_NODES; qi++) {
    const cell = queue[qi];
    if (!cell) continue;
    if (cell.t >= fuseTicks) continue;

    const nextT = cell.t + 1;

    // Try staying put
    const stayKey = `${cell.x},${cell.y},${nextT}`;
    if (!visited.has(stayKey)) {
      const dangerTick = dangerMap.get(`${cell.x},${cell.y}`);
      if (dangerTick === undefined || dangerTick > cell.t + fuseTicks) {
        visited.add(stayKey);
        queue.push({ x: cell.x, y: cell.y, t: nextT });
      }
    }

    // Try moving in each direction
    for (const dir of DIRS) {
      const nx = cell.x + dir.dx;
      const ny = cell.y + dir.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const tile = state.map.tiles[ny]?.[nx];
      if (tile?.type !== "empty") continue;

      const nkey = `${nx},${ny},${nextT}`;
      if (visited.has(nkey)) continue;

      const dangerTick = dangerMap.get(`${nx},${ny}`);
      if (dangerTick !== undefined && dangerTick <= cell.t + fuseTicks) continue;

      visited.add(nkey);
      queue.push({ x: nx, y: ny, t: nextT });
    }
  }

  // Check if any cell at t = fuseTicks is safe
  for (const entry of visited) {
    const parts = entry.split(",");
    const timePart = parts[2];
    if (timePart === undefined) continue;
    const t = parseInt(timePart, 10);
    if (t >= fuseTicks) return true;
  }

  return false;
}

// ─── BFS path to safety ───

interface BfsNode {
  x: number;
  y: number;
  tickOffset: number;
  cost: number;
  parent: BfsNode | null;
  dir: BombermanDirection | null;
  isWait: boolean;
}

function bfsToSafety(
  state: BombermanState,
  startX: number,
  startY: number,
  horizon: number,
  dangerMap: Map<string, number>,
  botPlayerId: string,
  maxNodes: number,
): BfsNode | null {
  const width = state.map.width;
  const height = state.map.height;
  const visited = new Set<string>();

  const startNode: BfsNode = {
    x: startX,
    y: startY,
    tickOffset: 0,
    cost: 0,
    parent: null,
    dir: null,
    isWait: false,
  };

  // Check if start is already safe for the entire horizon
  const startSafe = isSafeForDuration(state, startX, startY, 0, dangerMap, botPlayerId);
  if (startSafe) return startNode;

  const queue: BfsNode[] = [startNode];
  visited.add(`${startX},${startY},0`);

  for (let qi = 0; qi < queue.length && qi < maxNodes; qi++) {
    const node = queue[qi];
    if (!node) continue;
    if (node.tickOffset >= horizon) continue;

    const nextT = node.tickOffset + 1;

    // Check each direction in search order: up, right, down, left
    for (const dir of DIRS) {
      const nx = node.x + dir.dx;
      const ny = node.y + dir.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const tile = state.map.tiles[ny]?.[nx];
      if (tile?.type !== "empty") continue;

      const visitKey = `${nx},${ny},${nextT}`;
      if (visited.has(visitKey)) continue;
      visited.add(visitKey);

      // Check if this cell is dangerous at this tick
      const dangerTick = dangerMap.get(`${nx},${ny}`);
      if (dangerTick !== undefined && dangerTick <= nextT) continue;

      const child: BfsNode = {
        x: nx,
        y: ny,
        tickOffset: nextT,
        cost: node.cost + 1,
        parent: node,
        dir: dir.name,
        isWait: false,
      };

      // Check if we're now safe for the rest of the horizon
      if (isSafeForDuration(state, nx, ny, nextT, dangerMap, botPlayerId)) {
        return child;
      }

      queue.push(child);
    }

    // Wait (stay in place)
    const waitKey = `${node.x},${node.y},${nextT}`;
    if (!visited.has(waitKey)) {
      visited.add(waitKey);
      const dangerTick = dangerMap.get(`${node.x},${node.y}`);
      if (dangerTick === undefined || dangerTick > nextT) {
        const waitNode: BfsNode = {
          x: node.x,
          y: node.y,
          tickOffset: nextT,
          cost: node.cost,
          parent: node,
          dir: null,
          isWait: true,
        };
        if (isSafeForDuration(state, node.x, node.y, nextT, dangerMap, botPlayerId)) {
          return waitNode;
        }
        queue.push(waitNode);
      }
    }
  }

  return null;
}

/**
 * Check if a cell is safe (no danger) from `startTick` through `horizon`.
 */
function isSafeForDuration(
  state: BombermanState,
  x: number,
  y: number,
  startTick: number,
  dangerMap: Map<string, number>,
  botPlayerId: string,
): boolean {
  const dangerTick = dangerMap.get(`${x},${y}`);
  if (dangerTick !== undefined && dangerTick <= startTick) return false;
  // Check the cell is walkable (no bomb blocking unless SPIRIT)
  const hasSpirit = isBotHasSpirit(state, botPlayerId);
  if (!hasSpirit) {
    const bombHere = state.bombs.some((b) => b.x === x && b.y === y && !b.airborne);
    if (bombHere) return false;
  }
  return true;
}

function isBotHasSpirit(state: BombermanState, playerId: string): boolean {
  const player = state.players[playerId];
  return player?.items.includes("SPIRIT") ?? false;
}

// ─── Item pickup evaluation ───

function nearestItem(state: BombermanState, x: number, y: number, botPlayerId: string): number {
  const width = state.map.width;
  const height = state.map.height;

  // BFS to find nearest item
  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number; dist: number }> = [{ x, y, dist: 0 }];
  visited.add(`${x},${y}`);

  for (let qi = 0; qi < queue.length && qi < 100; qi++) {
    const cell = queue[qi];
    if (!cell) continue;
    for (const dir of CARDINAL_DIRS) {
      const nx = cell.x + dir.dx;
      const ny = cell.y + dir.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const tile = state.map.tiles[ny]?.[nx];
      if (tile?.type !== "empty") continue;

      // Check for bomb blocking
      const bombHere = state.bombs.some((b) => b.x === nx && b.y === ny && !b.airborne);
      if (bombHere && !isBotHasSpirit(state, botPlayerId)) continue;

      if (state.items.some((item) => item.x === nx && item.y === ny)) {
        return cell.dist + 1;
      }

      queue.push({ x: nx, y: ny, dist: cell.dist + 1 });
    }
  }

  return Infinity;
}

// ─── Score evaluation (normal/hard) ───

function evaluateState(
  state: BombermanState,
  botPlayerId: string,
  botX: number,
  botY: number,
  botAlive: boolean,
  difficulty: BombermanBotDifficulty,
): number {
  let score = 0;

  if (!botAlive) {
    return -1000000;
  }

  // Survival bonus
  score += 10000;

  // Item pickup potential (normal+)
  if (difficulty !== "easy") {
    const itemDist = nearestItem(state, botX, botY, botPlayerId);
    if (itemDist < Infinity) {
      score += 400 - itemDist * 20;
    }
  }

  // Soft wall destruction opportunity
  for (const dir of DIRS) {
    const nx = botX + dir.dx;
    const ny = botY + dir.dy;
    const tile = state.map.tiles[ny]?.[nx];
    if (tile && tile.type === "soft_wall") {
      score += 100;
    }
  }

  // Enemy proximity (normal+) and threat evaluation (hard)
  for (const [pid, player] of Object.entries(state.players)) {
    if (pid === botPlayerId || !player.alive) continue;

    const dist = Math.abs(player.x - botX) + Math.abs(player.y - botY);

    if (difficulty === "hard") {
      const isEnemy = player.teamId !== state.players[botPlayerId]?.teamId;
      if (isEnemy) {
        // Threatening enemies close by
        if (dist <= 3) {
          score += 300;
        }
        // Closer = more threatening (positive for hard bot to be aggressive)
        score += Math.max(0, 50 - dist * 5);
      } else if (dist <= 2) {
        // Teammate penalty for collateral
        score -= 5000;
      }
    } else if (dist <= 4) {
      // Normal: any other player nearby = threat
      score += Math.max(0, 30 - dist * 3);
    }
  }

  return score;
}

// ─── Main decision function ───

export function decideBombermanBotOperation(
  state: Readonly<BombermanState>,
  context: BombermanBotContext,
): BombermanBotDecision {
  const { playerId, difficulty, decisionTick, randomState } = context;
  const player = state.players[playerId];
  const config = DIFFICULTY_CONFIG[difficulty];

  if (!player?.alive) {
    return {
      operation: { type: "NOOP" },
      expandedNodes: 0,
      nextRandomState: randomState,
    };
  }

  if (decisionTick % config.decisionInterval !== 0) {
    // Not this bot's turn to decide
    return {
      operation: { type: "NOOP" },
      expandedNodes: 0,
      nextRandomState: randomState,
    };
  }

  const dangerMap = computeDangerMap(state, config.horizon);

  // ── 1. If currently in danger, escape first ──

  const currentDangerTick = dangerMap.get(`${player.x},${player.y}`);
  const inDanger = currentDangerTick !== undefined && currentDangerTick <= 3;

  if (inDanger) {
    // BFS to safety
    const safeNode = bfsToSafety(state, player.x, player.y, config.horizon, dangerMap, playerId, MAX_EXPANDED_NODES);

    if (safeNode?.dir) {
      return {
        operation: { type: "MOVE", direction: safeNode.dir },
        expandedNodes: safeNode.cost + 1,
        nextRandomState: randomState,
      };
    }
  }

  // ── 2. Evaluate candidates ──

  const canPlaceBomb = player.bombActive < player.bombMax;
  const fuseTicks = state.config.bombFuse;

  // Collect candidate operations with scores
  interface Candidate {
    op: BombermanOperation;
    score: number;
  }

  const candidates: Candidate[] = [];

  // MOVE candidates: each direction + current position (if safe)
  const moveCandidates: BombermanDirection[] = ["up", "down", "left", "right"];
  let nodesExpanded = 1; // danger map cost already counted

  for (const dir of moveCandidates) {
    const d = DIRS.find((d) => d.name === dir);
    if (!d) continue;
    const nx = player.x + d.dx;
    const ny = player.y + d.dy;
    if (nx < 0 || nx >= state.map.width || ny < 0 || ny >= state.map.height) continue;

    const tile = state.map.tiles[ny]?.[nx];
    if (tile?.type !== "empty") continue;

    // Check for bomb blocking (unless SPIRIT)
    const hasSpirit = isBotHasSpirit(state, playerId);
    if (!hasSpirit && state.bombs.some((b) => b.x === nx && b.y === ny && !b.airborne)) continue;

    // Check if safe at next tick
    const dangerTick = dangerMap.get(`${nx},${ny}`);
    if (dangerTick !== undefined && dangerTick <= 1) continue;

    nodesExpanded++;

    if (difficulty === "easy") {
      candidates.push({
        op: { type: "MOVE", direction: dir },
        score: 0,
      });
      continue;
    }

    const dist = evaluateState(state, playerId, nx, ny, true, difficulty);
    candidates.push({
      op: { type: "MOVE", direction: dir },
      score: dist,
    });
  }

  // PLACE_BOMB candidate (normal+)
  if (canPlaceBomb && difficulty !== "easy") {
    // Check if there's a soft wall or enemy nearby
    let hasTarget = false;
    for (const dir of DIRS) {
      const nx = player.x + dir.dx;
      const ny = player.y + dir.dy;
      const tile = state.map.tiles[ny]?.[nx];
      if (tile && tile.type === "soft_wall") {
        hasTarget = true;
        break;
      }
      // Hard: enemies in range
      if (difficulty === "hard") {
        for (const [, p] of Object.entries(state.players)) {
          if (p.playerId !== playerId && p.alive) {
            const dist = Math.abs(p.x - player.x) + Math.abs(p.y - player.y);
            if (dist <= state.config.blastRadius) {
              const isEnemy = p.teamId !== player.teamId;
              if (isEnemy) {
                hasTarget = true;
                break;
              }
            }
          }
        }
      }
      if (hasTarget) break;
    }

    if (hasTarget && hasEscapeRoute(state, player.x, player.y, fuseTicks, dangerMap)) {
      const futureDanger = new Map(dangerMap);
      const bombKey = `${player.x},${player.y}`;
      const existingTick = futureDanger.get(bombKey);
      if (existingTick === undefined || existingTick > fuseTicks) {
        futureDanger.set(bombKey, fuseTicks);
      }

      // Simulate a step to see if placing a bomb is advantageous
      const score = evaluateState(state, playerId, player.x, player.y, true, difficulty);
      candidates.push({
        op: { type: "PLACE_BOMB" },
        score: score + 200, // bonus for offensive play
      });
      nodesExpanded++;
    }
  }

  // DETONATE (hard only, with REMOTE)
  if (difficulty === "hard" && player.items.includes("REMOTE")) {
    const remoteBombs = state.bombs.filter((b) => b.playerId === playerId && !b.airborne);
    if (remoteBombs.length > 0) {
      // Check if any remote bomb would hit an enemy
      let detonateScore = 0;
      for (const bomb of remoteBombs) {
        // Check cells in blast radius
        for (const dir of CARDINAL_DIRS) {
          for (let dist = 0; dist <= bomb.blastRadius; dist++) {
            const cx = bomb.x + dir.dx * dist;
            const cy = bomb.y + dir.dy * dist;
            for (const [, p] of Object.entries(state.players)) {
              if (p.playerId !== playerId && p.alive && p.x === cx && p.y === cy) {
                const isEnemy = p.teamId !== player.teamId;
                detonateScore += isEnemy ? 2000 : -5000;
              }
            }
          }
        }
      }
      if (detonateScore > 0) {
        candidates.push({
          op: { type: "DETONATE" },
          score: 100000 + detonateScore,
        });
        nodesExpanded++;
      }
    }
  }

  // ACTION (hard only, with GLOVE/PUNCH/KICK) — simplified: if holding a carried bomb, throw it
  if (difficulty === "hard" && player.carriedBomb) {
    // Throw the carried bomb in facing direction
    candidates.push({
      op: { type: "ACTION" },
      score: 300,
    });
    nodesExpanded++;
  }

  // ── 3. Choose best candidate ──

  if (candidates.length === 0) {
    return {
      operation: { type: "NOOP" },
      expandedNodes: nodesExpanded,
      nextRandomState: randomState,
    };
  }

  // Find highest score; tie-breaking with PRNG
  candidates.sort((a, b) => b.score - a.score);
  const firstCandidate = candidates[0];
  if (!firstCandidate) {
    return {
      operation: { type: "NOOP" },
      expandedNodes: nodesExpanded,
      nextRandomState: randomState,
    };
  }
  const topScore = firstCandidate.score;
  const tied = candidates.filter((c) => c.score === topScore);

  let chosen: Candidate;
  if (tied.length === 1 || difficulty === "easy") {
    const firstTied = tied[0];
    if (!firstTied) {
      return {
        operation: { type: "NOOP" },
        expandedNodes: nodesExpanded,
        nextRandomState: randomState,
      };
    }
    chosen = firstTied;
  } else {
    const { value, nextSeed } = seededRandomChoice(tied, randomState);
    chosen = value;
    return {
      operation: chosen.op,
      expandedNodes: nodesExpanded,
      nextRandomState: nextSeed,
    };
  }

  return {
    operation: chosen.op,
    expandedNodes: nodesExpanded,
    nextRandomState: randomState,
  };
}
