import type {
  BombermanState,
  BombermanOperation,
  BombermanPlayer,
  PlayerId,
  BombermanConfig,
  BombermanGameEndResult,
} from "@generale/types";
import { GameStatus } from "@generale/types";
import { tick } from "../core/game";
import { generateBombermanMap, getSpawnPositions } from "../core/map-gen";

export class BombermanGame {
  private state: BombermanState;
  private destroyed = false;
  private tickTimerId: ReturnType<typeof setInterval> | null = null;
  private onEndCallbacks: Array<(result: BombermanGameEndResult) => void> = [];
  private onTickCallbacks: Array<(state: BombermanState) => void> = [];
  private queues: Record<PlayerId, BombermanOperation[]> = {};
  private bots: Array<{ playerId: PlayerId; getAction: (state: BombermanState) => BombermanOperation }> = [];
  private syncData: Record<PlayerId, { lastConfirmedOp: number }> = {};

  constructor(config: BombermanConfig, players: { id: string; name: string }[]) {
    const width = config.mapWidth;
    const height = config.mapHeight;
    const map = generateBombermanMap(width, height);
    const spawns = getSpawnPositions(players.length, width, height);

    const playerMap: Record<string, BombermanPlayer> = {};
    for (let i = 0; i < players.length; i++) {
      const spawn = spawns[i];
      const p = players[i];
      if (!(spawn && p)) continue;
      playerMap[p.id] = {
        playerId: p.id,
        name: p.name,
        alive: true,
        x: spawn.x,
        y: spawn.y,
        bombMax: config.bombLimit,
        bombActive: 0,
        blastRadius: config.blastRadius,
        speed: 1,
        items: [],
        facing: "down",
      };
    }

    this.state = {
      status: GameStatus.Playing,
      tick: 0,
      map,
      players: playerMap,
      bombs: [],
      explosions: [],
      items: [],
      config,
      bombIdCounter: 0,
    };

    for (const p of players) this.queues[p.id] = [];
  }

  getSyncData(): Record<PlayerId, { lastConfirmedOp: number }> {
    return this.syncData;
  }

  addBot(playerId: PlayerId, getAction: (state: BombermanState) => BombermanOperation): void {
    const w = this.state.config.mapWidth;
    const h = this.state.config.mapHeight;
    const allCorners = [
      { x: 1, y: 1 },
      { x: w - 2, y: 1 },
      { x: 1, y: h - 2 },
      { x: w - 2, y: h - 2 },
    ];
    const occupied = new Set(Object.values(this.state.players).map((p) => `${p.x},${p.y}`));
    const spawn = allCorners.find((c) => !occupied.has(`${c.x},${c.y}`));
    if (!spawn) return;
    this.state.players[playerId] = {
      playerId,
      name: `Bot-${playerId.slice(0, 8)}`,
      alive: true,
      x: spawn.x,
      y: spawn.y,
      bombMax: 1,
      bombActive: 0,
      blastRadius: 1,
      speed: 1,
      items: [],
      facing: "down",
    };
    this.bots.push({ playerId, getAction });
    this.queues[playerId] = [];
  }

  handleAction(pid: PlayerId, op: BombermanOperation, optimisticId?: number): void {
    // Track per-player confirmedOp — drop stale events
    if (!this.syncData[pid]) this.syncData[pid] = { lastConfirmedOp: 0 };
    if (typeof optimisticId === "number" && this.syncData[pid].lastConfirmedOp >= optimisticId) {
      return; // stale event, already confirmed
    }

    if (!this.queues[pid]) this.queues[pid] = [];

    if (op.type === "SET_DIRECTION") {
      // Discrete model: each SET_DIRECTION is exactly 1 tile. Client controls
      // the rate (1 on keydown, re-sends every 100ms while held, null on keyup).
      // This guarantees "1 press = 1 tile" without race conditions between
      // keyup-null and server tick auto-injection.
      if (op.direction === null) {
        // Null = stop intent. DON'T dedup the existing SET_DIRECTION in queue —
        // let the pending move process first, so brief keypresses still
        // result in 1 tile of movement. The null is informational only; the
        // next non-null event will overwrite, or queue exhaustion will end movement.
      } else {
        // Non-null: dedup existing SET_DIRECTION (replace intent), push new
        this.queues[pid] = this.queues[pid].filter((o) => o.type !== "SET_DIRECTION");
        this.queues[pid].push(op);
      }
    } else {
      this.queues[pid].push(op);
    }

    // Update lastConfirmedOp
    if (typeof optimisticId === "number") {
      this.syncData[pid].lastConfirmedOp = optimisticId;
    }
  }

  startTicking(): void {
    if (this.tickTimerId) return;
    const intervalMs = 1000 / this.state.config.tickRate;
    this.tickTimerId = setInterval(() => {
      for (const bot of this.bots) {
        const action = bot.getAction(this.state);
        if (!this.queues[bot.playerId]) this.queues[bot.playerId] = [];
        this.queues[bot.playerId]?.push(action);
      }

      // Snapshot queues before tick — tick() is pure, does not mutate this.queues
      const snapshot: Record<PlayerId, BombermanOperation[]> = {};
      for (const [pid, ops] of Object.entries(this.queues)) {
        snapshot[pid] = [...ops];
      }

      // Call pure tick — returns new state + which ops remain unconsumed
      const { state: nextState, remainingOps } = tick(this.state, snapshot);
      this.state = nextState;

      // Update queues: keep only remaining (unconsumed) ops
      for (const pid of Object.keys(this.queues)) {
        this.queues[pid] = remainingOps[pid] ?? [];
      }

      // Re-inject direction from pre-tick snapshot so direction intent survives across ticks
      for (const [pid, ops] of Object.entries(snapshot)) {
        // Find the last SET_DIRECTION op in the pre-tick snapshot
        let lastDir: BombermanOperation | undefined;
        for (let i = ops.length - 1; i >= 0; i--) {
          if (ops[i]?.type === "SET_DIRECTION") {
            lastDir = ops[i];
            break;
          }
        }
        if (lastDir) {
          if (!this.queues[pid]) this.queues[pid] = [];
          // Only re-inject if no newer SET_DIRECTION was added during tick processing
          if (!this.queues[pid].some((o) => o.type === "SET_DIRECTION")) {
            this.queues[pid].push(lastDir);
          }
        }
      }

      for (const cb of this.onTickCallbacks) {
        try {
          cb(this.state);
        } catch {}
      }

      if (this.state.status === GameStatus.Ended) {
        this.stopTicking();
        this.triggerEnd();
      }
    }, intervalMs);
  }

  stopTicking(): void {
    if (this.tickTimerId) {
      clearInterval(this.tickTimerId);
      this.tickTimerId = null;
    }
  }

  getState(): BombermanState {
    return this.state;
  }

  onTick(cb: (state: BombermanState) => void): void {
    this.onTickCallbacks.push(cb);
  }

  private triggerEnd(): void {
    const alive = Object.values(this.state.players).filter((p) => p.alive);
    const result: BombermanGameEndResult = {
      winnerId: alive.length === 1 ? (alive[0]?.playerId ?? null) : null,
      reason: alive.length <= 1 ? "last_alive" : "timeout",
      state: this.state,
    };
    for (const cb of this.onEndCallbacks) cb(result);
  }

  onEnd(cb: (result: BombermanGameEndResult) => void): void {
    this.onEndCallbacks.push(cb);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopTicking();
    this.onEndCallbacks = [];
    this.onTickCallbacks = [];
  }
}
