import type { BombermanState, BombermanPlayer, BombermanRoomState, BombermanWinner } from "@generale/types";

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

export interface BombermanScoreRow {
  competitor: BombermanWinner;
  label: string;
  wins: number;
  targetWins: number;
  isMatchPoint: boolean;
}

/**
 * Build score rows from match state for scoreboard display.
 * Resolves competitor IDs to player/team labels.
 */
export function getBombermanScoreRows(state: BombermanRoomState): BombermanScoreRow[] {
  const { scores, targetWins } = state.match;
  const playerMap = new Map(state.players.map((p) => [p.id, p]));
  const teamMap = new Map(state.teams.map((t) => [t.id, t]));
  return scores.map(({ competitor, wins }) => {
    const label =
      competitor.kind === "player"
        ? (playerMap.get(competitor.id)?.name ?? competitor.id.slice(0, 8))
        : (teamMap.get(competitor.id)?.name ?? competitor.id.slice(0, 8));
    return {
      competitor,
      label,
      wins,
      targetWins,
      isMatchPoint: wins >= targetWins - 1,
    };
  });
}

/**
 * Returns true when any competitor is one win away from winning the match.
 */
export function isBombermanMatchPoint(state: BombermanRoomState): boolean {
  const { scores, targetWins } = state.match;
  return scores.some((s) => s.wins >= targetWins - 1);
}
