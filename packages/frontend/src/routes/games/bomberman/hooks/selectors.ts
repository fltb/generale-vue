import type { BombermanState, BombermanPlayer } from "@generale/types";

/**
 * Pure selector functions for bomberman game state.
 * No Solid imports — easy to unit test.
 */

export interface PlayerSummary {
  playerId: string;
  name: string;
  alive: boolean;
}

/**
 * Extract a flat list of player summaries from the game state.
 */
export function playerSummaries(state: BombermanState): PlayerSummary[] {
  return Object.values(state.players ?? {}).map((p) => ({
    playerId: p.playerId,
    name: p.name,
    alive: p.alive,
  }));
}

/**
 * Check if any player is still alive (game in progress).
 */
export function isGameInProgress(players: Record<string, BombermanPlayer>): boolean {
  return Object.values(players ?? {}).some((p) => p.alive);
}

export interface EndgameResult {
  rankings: Array<{ name: string; rank: number; playerId: string }>;
  winnerId?: string;
}

/**
 * Compute endgame rankings sorted by alive status (alive players first).
 */
export function computeEndgameResult(state: BombermanState): EndgameResult {
  const players = Object.values(state.players ?? {});
  const sorted = [...players]
    .sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? -1 : 1))
    .map((p, i) => ({
      name: p.name ?? p.playerId.slice(0, 8),
      rank: i + 1,
      playerId: p.playerId,
    }));
  const winner = sorted.find((r) => r.rank === 1);
  return { rankings: sorted, winnerId: winner?.playerId };
}
