import { and, asc, count, desc, eq, gt, inArray, lte } from "drizzle-orm";

import { gzipSync, gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import type {
  BombermanReplayHeader,
  BombermanReplay,
  BombermanReplayRound,
  BombermanReplaySummary,
  BombermanMatchState,
  BombermanWinner,
  BombermanMatchFormat,
  PlayerId,
} from "@generale/types";
import { BOMBERMAN_REPLAY_ENGINE_VERSION } from "@generale/types";
import { db } from "../db/client";
import { bombermanReplays, bombermanReplayParticipants, bombermanReplayRounds } from "../db/schema";

// ── Helpers ──

function packPayload(round: BombermanReplayRound): string {
  const json = JSON.stringify(round);
  return Buffer.from(gzipSync(json)).toString("base64");
}

function unpackPayload(blob: string): BombermanReplayRound {
  const buf = Buffer.from(blob, "base64");
  const json = gunzipSync(buf).toString("utf-8");
  return JSON.parse(json) as BombermanReplayRound;
}

// ── Service ──

export const bombermanReplayService = {
  /**
   * Start recording a new replay.
   * Returns the replay id, or throws on DB failure.
   */
  startRecording(header: BombermanReplayHeader, participantUserIds: PlayerId[]): string {
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    db.insert(bombermanReplays)
      .values({
        id,
        matchId: header.matchId,
        status: "recording",
        engineVersion: BOMBERMAN_REPLAY_ENGINE_VERSION,
        format: header.config.matchFormat,
        configJson: JSON.stringify(header.config),
        createdAt: now,
        expiresAt,
      })
      .run();

    // Insert participants (bots excluded -- they have no userId)
    if (participantUserIds.length > 0) {
      db.insert(bombermanReplayParticipants)
        .values(participantUserIds.map((userId) => ({ replayId: id, userId })))
        .run();
    }

    return id;
  },

  /**
   * Append a completed round to a replay recording.
   * The payload is gzip-compressed before storage.
   */
  appendRound(replayId: string, round: BombermanReplayRound): void {
    const blob = packPayload(round);
    const sequence = round.attempt > 1 ? round.roundNumber * 100 + round.attempt : round.roundNumber;

    db.insert(bombermanReplayRounds)
      .values({
        replayId,
        sequence,
        roundNumber: round.roundNumber,
        attempt: round.attempt,
        ticks: round.result.ticks,
        payloadBlob: blob,
      })
      .run();
  },

  /**
   * Mark a replay as complete with the final match result.
   */
  complete(replayId: string, result: BombermanMatchState, winner: BombermanWinner | null): void {
    db.update(bombermanReplays)
      .set({
        status: "complete",
        resultJson: JSON.stringify(result),
        winnerJson: winner ? JSON.stringify(winner) : null,
      })
      .where(eq(bombermanReplays.id, replayId))
      .run();
  },

  /**
   * Discard an in-progress recording (e.g. service destroy with incomplete match).
   */
  discard(replayId: string): void {
    // Cascade delete handles participants and rounds
    db.delete(bombermanReplays).where(eq(bombermanReplays.id, replayId)).run();
  },

  /**
   * List replays available to a given user.
   * Only complete replays where the user is a participant are returned.
   */
  listForUser(userId: PlayerId, limit: number, offset: number): BombermanReplaySummary[] {
    const safeLimit = Math.max(1, Math.min(50, limit));
    const safeOffset = Math.max(0, offset);

    // Find replay IDs the user participated in
    const participantRows = db
      .select({ replayId: bombermanReplayParticipants.replayId })
      .from(bombermanReplayParticipants)
      .where(eq(bombermanReplayParticipants.userId, userId))
      .all() as Array<{ replayId: string }>;

    if (participantRows.length === 0) return [];

    const replayIds = participantRows.map((r) => r.replayId);

    const rows = db
      .select({
        id: bombermanReplays.id,
        createdAt: bombermanReplays.createdAt,
        expiresAt: bombermanReplays.expiresAt,
        format: bombermanReplays.format,
        winnerJson: bombermanReplays.winnerJson,
        status: bombermanReplays.status,
      })
      .from(bombermanReplays)
      .where(
        and(
          inArray(bombermanReplays.id, replayIds),
          eq(bombermanReplays.status, "complete"),
          gt(bombermanReplays.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(bombermanReplays.createdAt))
      .limit(safeLimit)
      .offset(safeOffset)
      .all() as Array<Record<string, unknown>>;

    return rows.map((row) => {
      const createdAt = row["createdAt"] instanceof Date ? (row["createdAt"] as Date).getTime() : 0;
      const expiresAt = row["expiresAt"] instanceof Date ? (row["expiresAt"] as Date).getTime() : 0;
      const format = row["format"] as string;
      const winnerJson = row["winnerJson"] as string | null;
      const id = row["id"] as string;
      let winner: BombermanWinner | null = null;
      if (winnerJson) {
        try {
          winner = JSON.parse(winnerJson) as BombermanWinner;
        } catch {
          // ignore parse error
        }
      }
      return {
        id,
        createdAt,
        expiresAt,
        format: format as BombermanMatchFormat,
        winner,
        roundCount: this.getRoundCount(id),
      };
    });
  },

  /**
   * Get the round count for a replay.
   */
  getRoundCount(replayId: string): number {
    const result = db
      .select({ count: count() })
      .from(bombermanReplayRounds)
      .where(eq(bombermanReplayRounds.replayId, replayId))
      .all() as Array<{ count: number }>;
    return result[0]?.count ?? 0;
  },

  /**
   * Get a full replay for a given user.
   * Returns null if the user is not a participant, the replay doesn't exist,
   * is incomplete, or has expired.
   * Throws "REPLAY_CORRUPT" on payload parse errors.
   */
  getForUser(userId: PlayerId, replayId: string): BombermanReplay | null {
    // Check participant access
    const participant = db
      .select({ userId: bombermanReplayParticipants.userId })
      .from(bombermanReplayParticipants)
      .where(and(eq(bombermanReplayParticipants.replayId, replayId), eq(bombermanReplayParticipants.userId, userId)))
      .all() as Array<{ userId: string }>;

    if (participant.length === 0) return null;

    // Fetch header
    const headerRows = db
      .select({
        id: bombermanReplays.id,
        matchId: bombermanReplays.matchId,
        status: bombermanReplays.status,
        engineVersion: bombermanReplays.engineVersion,
        format: bombermanReplays.format,
        configJson: bombermanReplays.configJson,
        winnerJson: bombermanReplays.winnerJson,
        resultJson: bombermanReplays.resultJson,
        expiresAt: bombermanReplays.expiresAt,
      })
      .from(bombermanReplays)
      .where(eq(bombermanReplays.id, replayId))
      .all() as Array<{
      id: string;
      matchId: string;
      status: string;
      engineVersion: number;
      format: string;
      configJson: string | null;
      winnerJson: string | null;
      resultJson: string | null;
      expiresAt: Date;
    }>;

    const header = headerRows[0];
    if (!header) return null;
    if (header.expiresAt.getTime() <= Date.now()) return null;

    // Fetch rounds
    const roundRows = db
      .select({
        sequence: bombermanReplayRounds.sequence,
        roundNumber: bombermanReplayRounds.roundNumber,
        attempt: bombermanReplayRounds.attempt,
        ticks: bombermanReplayRounds.ticks,
        payloadBlob: bombermanReplayRounds.payloadBlob,
      })
      .from(bombermanReplayRounds)
      .where(eq(bombermanReplayRounds.replayId, replayId))
      .orderBy(asc(bombermanReplayRounds.sequence))
      .all() as Array<{
      sequence: number;
      roundNumber: number;
      attempt: number;
      ticks: number;
      payloadBlob: string;
    }>;

    // Unpack rounds
    const rounds: BombermanReplayRound[] = [];
    for (const rr of roundRows) {
      try {
        rounds.push(unpackPayload(rr.payloadBlob));
      } catch {
        throw new Error("REPLAY_CORRUPT");
      }
    }

    // Parse JSON fields
    let config: BombermanReplayHeader["config"] | null = null;
    if (header.configJson) {
      try {
        config = JSON.parse(header.configJson);
      } catch {
        // treat as missing
      }
    }

    let result: BombermanMatchState | null = null;
    if (header.resultJson) {
      try {
        result = JSON.parse(header.resultJson) as BombermanMatchState;
      } catch {
        throw new Error("REPLAY_CORRUPT");
      }
    }

    if (!(config && result)) throw new Error("REPLAY_CORRUPT");

    return {
      schemaVersion: 1 as const,
      engineVersion: header.engineVersion as 1,
      matchId: header.matchId,
      config: config,
      participants: [],
      rounds,
      result: result,
    };
  },

  /**
   * Remove expired replays.
   * Returns the count of removed replays.
   */
  cleanupExpired(now: number): number {
    const oldRows = db
      .select({ id: bombermanReplays.id })
      .from(bombermanReplays)
      .where(lte(bombermanReplays.expiresAt, new Date(now)))
      .all() as Array<{ id: string }>;

    if (oldRows.length === 0) return 0;

    const ids = oldRows.map((r) => r.id);
    db.delete(bombermanReplayRounds).where(inArray(bombermanReplayRounds.replayId, ids)).run();
    db.delete(bombermanReplayParticipants).where(inArray(bombermanReplayParticipants.replayId, ids)).run();
    db.delete(bombermanReplays).where(inArray(bombermanReplays.id, ids)).run();

    return ids.length;
  },
};
