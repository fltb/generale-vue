import type { BombermanTile, BombermanMapDefinition, BombermanMapValidationIssue } from "@generale/types";
import type { BombermanRandom } from "./random.js";

// ─── Public options ───

export interface BombermanMapGenerationOptions {
  width: number;
  height: number;
  themeId: string;
  softWallDensity: number;
  random: BombermanRandom;
}

// ─── BFS helpers ───

const CARDINAL_DIRECTIONS = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
] as const;

function bfsDistances(
  tiles: BombermanTile[][],
  start: { x: number; y: number },
  allowSoftWalls: boolean,
): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: Array<{ x: number; y: number }> = [{ x: start.x, y: start.y }];
  distances.set(`${start.x},${start.y}`, 0);

  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    if (!cell) continue;
    const distance = distances.get(`${cell.x},${cell.y}`);
    if (distance === undefined) continue;

    for (const [dx, dy] of CARDINAL_DIRECTIONS) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      const key = `${nx},${ny}`;
      if (distances.has(key)) continue;
      const tile = tiles[ny]?.[nx];
      if (!(tile && tile.type !== "hard_wall" && (allowSoftWalls || tile.type !== "soft_wall"))) continue;
      distances.set(key, distance + 1);
      queue.push({ x: nx, y: ny });
    }
  }

  return distances;
}

// ─── Public API ───

/**
 * Generate a deterministic Bomberman map.
 * The `random` parameter should be seeded per-match for reproducibility.
 */
export function generateBombermanMap(options: BombermanMapGenerationOptions): BombermanMapDefinition {
  const { width: rawW, height: rawH, themeId, softWallDensity, random } = options;
  const width = rawW % 2 === 1 ? rawW : rawW + 1;
  const height = rawH % 2 === 1 ? rawH : rawH + 1;

  const tiles: BombermanTile[][] = [];
  for (let y = 0; y < height; y++) {
    const row: BombermanTile[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ type: "empty" });
    }
    tiles.push(row);
  }

  // Hard walls: borders + pillars at even-even
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        tiles[y]![x] = { type: "hard_wall" };
      } else if (x % 2 === 0 && y % 2 === 0) {
        tiles[y]![x] = { type: "hard_wall" };
      }
    }
  }

  // Spawn positions: 4 corners
  const spawns = getSpawnPositions(4, width, height);

  // Safe zones around each spawn (3x3)
  const safeSet = new Set<string>();
  for (const s of spawns) {
    if (!s) continue;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        safeSet.add(`${s.x + dx},${s.y + dy}`);
      }
    }
  }

  // All non-safe, non-pillar tiles as soft wall candidates
  const candidates: { x: number; y: number }[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (x % 2 === 0 && y % 2 === 0) continue;
      if (safeSet.has(`${x},${y}`)) continue;
      candidates.push({ x, y });
    }
  }

  // Carve corridors between spawns
  const validSpawns = spawns.filter(Boolean) as { x: number; y: number }[];
  const rest = validSpawns.slice(1);
  let cur: { x: number; y: number } = validSpawns[0]!;
  for (const target of rest) {
    const path = bfsPath(tiles, cur, target);
    if (path) {
      for (const p of path) {
        const tile = tiles[p.y]?.[p.x];
        if (tile && tile.type === "soft_wall") {
          tile.type = "empty";
        }
      }
    }
    cur = target;
  }

  // Randomly add soft walls to candidates
  for (const c of candidates) {
    if (random.next() < softWallDensity) {
      tiles[c.y]![c.x] = { type: "soft_wall" };
    }
  }

  // Ensure spawn exits are clear
  for (const s of validSpawns) {
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (const d of directions) {
      const cx = s.x + d.dx;
      const cy = s.y + d.dy;
      const tile = tiles[cy]?.[cx];
      if (tile && tile.type === "soft_wall") {
        tile.type = "empty";
      }
    }
  }

  return {
    schemaVersion: 1,
    width,
    height,
    themeId,
    tiles,
    spawns: validSpawns,
    fixedItems: [],
  };
}

function bfsPath(
  tiles: BombermanTile[][],
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number }[] | null {
  const visited = new Set<string>();
  const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [
    { x: start.x, y: start.y, path: [start] },
  ];
  visited.add(`${start.x},${start.y}`);

  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (cell.x === end.x && cell.y === end.y) return cell.path;

    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const nx = cell.x + dx;
      const ny = cell.y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      const row = tiles[ny];
      if (!row) continue;
      const tile = row[nx];
      if (!tile || tile.type === "hard_wall") continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: [...cell.path, { x: nx, y: ny }] });
    }
  }

  return null;
}

/** Get spawn positions for N players (2-4). Standard corners. */
export function getSpawnPositions(
  playerCount: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [
    { x: 1, y: 1 },
    { x: width - 2, y: 1 },
    { x: 1, y: height - 2 },
    { x: width - 2, y: height - 2 },
  ];
  if (playerCount === 2) return [corners[0]!, corners[3]!];
  if (playerCount === 3) return [corners[0]!, corners[1]!, corners[3]!];
  return corners.slice(0, playerCount);
}

/** Validate each spawn has ≥2 adjacent empty cells. */
function validateSpawnSafeZones(
  tiles: BombermanTile[][],
  spawns: { x: number; y: number }[],
): BombermanMapValidationIssue[] {
  const issues: BombermanMapValidationIssue[] = [];
  for (const s of spawns) {
    const dirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    ];
    let safeCount = 0;
    for (const d of dirs) {
      const tile = tiles[s.y + d.dy]?.[s.x + d.dx];
      if (tile && tile.type === "empty") safeCount++;
    }
    if (safeCount < 2) {
      issues.push({ code: "UNSAFE_SPAWN", path: `spawns[(${s.x},${s.y})]` });
    }
  }
  return issues;
}

/** Validate 3×3 spawn zones have no soft walls. */
function validateSpawnNoWalls(
  tiles: BombermanTile[][],
  spawns: { x: number; y: number }[],
): BombermanMapValidationIssue[] {
  const issues: BombermanMapValidationIssue[] = [];
  for (const s of spawns) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tile = tiles[s.y + dy]?.[s.x + dx];
        if (tile && tile.type === "soft_wall") {
          issues.push({ code: "UNSAFE_SPAWN", path: `tiles[${s.y + dy}][${s.x + dx}]` });
        }
      }
    }
  }
  return issues;
}

/** Validate spawn connectivity (ignoring soft walls). */
function validateConnectivityFull(
  tiles: BombermanTile[][],
  width: number,
  height: number,
  spawns: { x: number; y: number }[],
): BombermanMapValidationIssue[] {
  if (spawns.length === 0) return [];
  const visited = bfsDistances(tiles, spawns[0]!, false);

  for (const s of spawns) {
    if (!visited.has(`${s.x},${s.y}`)) {
      return [{ code: "DISCONNECTED", path: `spawns[(${s.x},${s.y})]` }];
    }
  }

  let totalPassable = 0;
  let reachable = 0;
  for (let y = 0; y < height; y++) {
    const row = tiles[y]!;
    for (let x = 0; x < width; x++) {
      const tile = row[x]!;
      if (tile.type !== "hard_wall" && tile.type !== "soft_wall") {
        totalPassable++;
        if (visited.has(`${x},${y}`)) reachable++;
      }
    }
  }

  if (totalPassable > 0 && reachable / totalPassable < 0.8) {
    return [{ code: "DISCONNECTED", path: "map" }];
  }

  return [];
}

/** Validate spawn-to-center path fairness (max 20% variation). */
function validatePathFairness(
  tiles: BombermanTile[][],
  width: number,
  height: number,
  spawns: { x: number; y: number }[],
): BombermanMapValidationIssue[] {
  if (spawns.length < 2) return [];

  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const distances: number[] = [];

  for (const s of spawns) {
    const dist = bfsDistances(tiles, s, true).get(`${center.x},${center.y}`) ?? Infinity;
    if (dist === Infinity) return [{ code: "UNFAIR_PATHS", path: `spawns[(${s.x},${s.y})] -> center` }];
    distances.push(dist);
  }

  const minDist = Math.min(...distances);
  const maxDist = Math.max(...distances);
  if (minDist > 0 && (maxDist - minDist) / minDist > 0.2) {
    return [{ code: "UNFAIR_PATHS", path: "spawns" }];
  }

  return [];
}

/** Validate soft wall density is 35–70% in playable non-safe area. */
function validateWallDensity(
  tiles: BombermanTile[][],
  width: number,
  height: number,
  spawns: { x: number; y: number }[],
): BombermanMapValidationIssue[] {
  const safeSet = new Set<string>();
  for (const s of spawns) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        safeSet.add(`${s.x + dx},${s.y + dy}`);
      }
    }
  }

  let totalCandidates = 0;
  let softCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (x % 2 === 0 && y % 2 === 0) continue;
      if (safeSet.has(`${x},${y}`)) continue;
      totalCandidates++;
      if (tiles[y]![x]!.type === "soft_wall") softCount++;
    }
  }

  if (totalCandidates > 0) {
    const density = softCount / totalCandidates;
    if (density < 0.35 || density > 0.7) {
      return [{ code: "INVALID_WALL_DENSITY", path: "map" }];
    }
  }

  return [];
}

/** Validate fixed items: unique coords, quadrant balanced. */
function validateFixedItems(
  items: { x: number; y: number }[],
  width: number,
  height: number,
): BombermanMapValidationIssue[] {
  if (items.length === 0) return [];

  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.x},${item.y}`;
    if (seen.has(key)) {
      return [{ code: "UNBALANCED_ITEMS", path: `items[(${item.x},${item.y})]` }];
    }
    seen.add(key);
  }

  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const quadrants = [0, 0, 0, 0]; // TL, TR, BL, BR
  for (const item of items) {
    const qIdx = (item.y < midY ? 0 : 2) + (item.x < midX ? 0 : 1);
    quadrants[qIdx]++;
  }

  const nonEmpty = quadrants.filter((c) => c > 0);
  if (nonEmpty.length > 0) {
    const maxCount = Math.max(...nonEmpty);
    const minCount = Math.min(...nonEmpty);
    if (maxCount - minCount > 1) {
      return [{ code: "UNBALANCED_ITEMS", path: "items" }];
    }
  }

  return [];
}

/**
 * Full validation of a Bomberman map definition.
 * Returns empty array for a valid map.
 */
export function validateBombermanMapDefinition(map: BombermanMapDefinition): BombermanMapValidationIssue[] {
  const issues: BombermanMapValidationIssue[] = [];

  // 1. Dimensions: odd, 11–31
  if (map.width < 11 || map.width > 31 || map.height < 11 || map.height > 31) {
    issues.push({ code: "INVALID_DIMENSIONS", path: "width/height" });
  }
  if (map.width % 2 !== 1 || map.height % 2 !== 1) {
    issues.push({ code: "INVALID_DIMENSIONS", path: "width/height" });
  }

  // 2. Tiles grid validity
  if (map.tiles.length !== map.height) {
    issues.push({ code: "INVALID_TILES", path: "tiles" });
  } else {
    for (let y = 0; y < map.tiles.length; y++) {
      const row = map.tiles[y]!;
      if (row.length !== map.width) {
        issues.push({ code: "INVALID_TILES", path: `tiles[${y}]` });
        break;
      }
      for (let x = 0; x < row.length; x++) {
        const tile = row[x]!;
        if (tile.type !== "empty" && tile.type !== "hard_wall" && tile.type !== "soft_wall") {
          issues.push({ code: "INVALID_TILES", path: `tiles[${y}][${x}]` });
        }
      }
    }
  }

  // 3. Spawns: 2–4 unique, on empty cells
  if (map.spawns.length < 2 || map.spawns.length > 4) {
    issues.push({ code: "INVALID_SPAWNS", path: "spawns" });
  } else {
    const spawnSet = new Set<string>();
    for (let i = 0; i < map.spawns.length; i++) {
      const s = map.spawns[i]!;
      const key = `${s.x},${s.y}`;
      if (spawnSet.has(key)) {
        issues.push({ code: "INVALID_SPAWNS", path: `spawns[${i}]` });
      } else {
        spawnSet.add(key);
      }

      const tile = map.tiles[s.y]?.[s.x];
      if (!tile || tile.type !== "empty") {
        issues.push({ code: "INVALID_SPAWNS", path: `spawns[${i}]` });
      }
    }

    issues.push(...validateSpawnSafeZones(map.tiles, map.spawns));
    issues.push(...validateSpawnNoWalls(map.tiles, map.spawns));
  }

  issues.push(...validateConnectivityFull(map.tiles, map.width, map.height, map.spawns));
  issues.push(...validatePathFairness(map.tiles, map.width, map.height, map.spawns));
  issues.push(...validateWallDensity(map.tiles, map.width, map.height, map.spawns));
  issues.push(...validateFixedItems(map.fixedItems, map.width, map.height));

  return issues;
}
