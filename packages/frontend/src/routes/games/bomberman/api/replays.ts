/**
 * Replay list/detail API wrapper for bomberman.
 * GET /replays returns BombermanReplaySummary[].
 * GET /replays/:id returns full BombermanReplay (with rounds, frames, state).
 */

import type { BombermanReplay, BombermanReplaySummary } from "@generale/types";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch paginated replay list for the current user.
 * Only complete, non-expired replays where the user is a participant are returned.
 */
export async function fetchBombermanReplays(limit = 20, offset = 0): Promise<BombermanReplaySummary[]> {
  const clampLimit = Math.max(1, Math.min(50, limit));
  const qs = new URLSearchParams({ limit: String(clampLimit), offset: String(Math.max(0, offset)) });
  const res = await fetch(`/api/bomberman/replays?${qs}`);
  const d: ApiResponse<BombermanReplaySummary[]> = await res.json();
  if (!d.success) throw new Error(d.error ?? "Failed to fetch replays");
  return d.data ?? [];
}

/**
 * Fetch a full replay by id.
 * Returns null for 404 (not found / not participant).
 * Throws on corrupt data or other errors.
 */
export async function fetchBombermanReplayDetail(id: string): Promise<BombermanReplay | null> {
  const res = await fetch(`/api/bomberman/replays/${encodeURIComponent(id)}`);
  const d: ApiResponse<BombermanReplay> = await res.json();
  if (!d.success) {
    if (res.status === 404) return null;
    if (d.error === "REPLAY_CORRUPT") throw new Error("REPLAY_CORRUPT");
    throw new Error(d.error ?? "Failed to fetch replay");
  }
  return d.data ?? null;
}
