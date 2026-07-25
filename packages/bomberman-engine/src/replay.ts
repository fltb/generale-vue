import type { BombermanState, BombermanOperation, PlayerId } from "@generale/types";

import { tick } from "./game.js";

// ─── Replay data types ───

export interface BombermanReplayFrame {
  tick: number;
  operations: Array<{ playerId: PlayerId; operation: BombermanOperation }>;
}

export interface BombermanReplayRound {
  roundNumber: number;
  attempt: number;
  seed: number;
  initialState: BombermanState;
  frames: BombermanReplayFrame[];
  result: {
    roundNumber: number;
    attempt: number;
    winner: { kind: "player"; id: PlayerId } | null;
    reason: "last_alive" | "timeout" | "draw";
    ticks: number;
  };
}

export interface BombermanReplayParticipant {
  playerId: PlayerId;
  name: string;
  teamId: string;
  skinId: string;
  isBot: boolean;
}

// ─── Replay session ───

export interface BombermanReplaySession {
  getState(): BombermanState;
  getTick(): number;
  step(): BombermanState;
  seek(tick: number): BombermanState;
}

/** Default checkpoint interval in ticks. */
const DEFAULT_CHECKPOINT_INTERVAL = 100;

/**
 * Create a replay session for a given round.
 *
 * Uses checkpoints every `checkpointInterval` ticks (default 100).
 * `seek(t)` recomputes from the nearest checkpoint <= t — never materializes
 * the full state array.
 */
export function createBombermanReplaySession(
  round: BombermanReplayRound,
  checkpointInterval: number = DEFAULT_CHECKPOINT_INTERVAL,
): BombermanReplaySession {
  const totalTicks = round.frames.length;

  // Build operation map: tick -> operations[]
  const frameOps = new Map<number, Array<{ playerId: PlayerId; operation: BombermanOperation }>>();
  for (const frame of round.frames) {
    frameOps.set(frame.tick, frame.operations);
  }

  // Checkpoint store: tick -> frozen state
  const checkpoints = new Map<number, BombermanState>();
  checkpoints.set(0, round.initialState);

  /**
   * Compute state from a known base checkpoint to the target tick.
   */
  function compute(fromTick: number, toTick: number, baseState: BombermanState): BombermanState {
    let current = structuredClone(baseState) as BombermanState;

    for (let t = fromTick; t < toTick; t++) {
      const queues: Record<PlayerId, BombermanOperation[]> = {};
      const opsForTick = frameOps.get(t) ?? [];

      for (const entry of opsForTick) {
        if (!queues[entry.playerId]) queues[entry.playerId] = [];
        queues[entry.playerId]!.push(entry.operation);
      }

      for (const pid of Object.keys(current.players)) {
        if (!queues[pid as PlayerId]) queues[pid as PlayerId] = [];
      }

      const result = tick(current, queues);
      current = result.state;

      // Build checkpoint if at boundary
      if ((t + 1) % checkpointInterval === 0 && !checkpoints.has(t + 1)) {
        checkpoints.set(t + 1, structuredClone(current) as BombermanState);
      }
    }

    return current;
  }

  /**
   * Find the nearest checkpoint at or before the given tick.
   */
  function nearestCheckpoint(targetTick: number): { tick: number; state: BombermanState } {
    const clamped = Math.max(0, Math.min(targetTick, totalTicks));

    let nearest = 0;
    let nearestState = checkpoints.get(0)!;

    for (const [ckTick, ckState] of checkpoints) {
      if (ckTick <= clamped && ckTick >= nearest) {
        nearest = ckTick;
        nearestState = ckState;
      }
    }

    return { tick: nearest, state: nearestState };
  }

  let cursorTick = 0;
  let cursorState = structuredClone(round.initialState) as BombermanState;

  return {
    getState(): BombermanState {
      return cursorState;
    },

    getTick(): number {
      return cursorTick;
    },

    step(): BombermanState {
      if (cursorTick >= totalTicks) return cursorState;

      const targetTick = cursorTick + 1;

      const ck = checkpoints.get(targetTick);
      if (ck) {
        cursorState = structuredClone(ck) as BombermanState;
        cursorTick = targetTick;
        return cursorState;
      }

      // Build queues from frame ops at cursorTick
      const queues: Record<PlayerId, BombermanOperation[]> = {};
      const opsForTick = frameOps.get(cursorTick) ?? [];
      for (const entry of opsForTick) {
        if (!queues[entry.playerId]) queues[entry.playerId] = [];
        queues[entry.playerId]!.push(entry.operation);
      }
      for (const pid of Object.keys(cursorState.players)) {
        if (!queues[pid as PlayerId]) queues[pid as PlayerId] = [];
      }

      // Save checkpoint before advancing if at boundary
      if (cursorTick > 0 && cursorTick % checkpointInterval === 0 && !checkpoints.has(cursorTick)) {
        checkpoints.set(cursorTick, structuredClone(cursorState) as BombermanState);
      }

      const result = tick(cursorState, queues);
      cursorState = result.state;
      cursorTick++;

      return cursorState;
    },

    seek(targetTick: number): BombermanState {
      const clamped = Math.max(0, Math.min(targetTick, totalTicks));

      if (clamped === cursorTick) return cursorState;

      // Recompute from nearest checkpoint
      const { tick: ckTick, state: ckState } = nearestCheckpoint(clamped);
      cursorState = compute(ckTick, clamped, ckState);
      cursorTick = clamped;

      return cursorState;
    },
  };
}
