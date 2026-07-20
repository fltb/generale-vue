import type {
  BombermanState,
  BombermanOperation,
  BombermanDirection,
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

  private intents: Record<
    PlayerId,
    { activeDirection: BombermanDirection | null; pendingDirection: BombermanDirection | null }
  > = {};
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
    for (const p of players) this.intents[p.id] = { activeDirection: null, pendingDirection: null };
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
    this.intents[playerId] = { activeDirection: null, pendingDirection: null };
    this.queues[playerId] = [];
  }

  handleAction(pid: PlayerId, op: BombermanOperation): void {
    // Track per-player confirmedOp — drop stale events
    const optimisticId = op.optimisticId;
    if (!this.syncData[pid]) this.syncData[pid] = { lastConfirmedOp: 0 };
    if (typeof optimisticId === "number" && this.syncData[pid].lastConfirmedOp >= optimisticId) {
      return; // stale event, already confirmed
    }

    if (!this.queues[pid]) this.queues[pid] = [];

    if (op.type === "SET_DIRECTION") {
      // Direction intent — does not enter the ordinary queue.
      // Non-null direction both activates and marks a pending step.
      // Null clears only activeDirection, preserving pending for one final step.
      if (!this.intents[pid]) this.intents[pid] = { activeDirection: null, pendingDirection: null };
      if (op.direction !== null) {
        this.intents[pid].activeDirection = op.direction;
        this.intents[pid].pendingDirection = op.direction;
      } else {
        this.intents[pid].activeDirection = null;
      }
    } else {
      // All other operations (MOVE, PLACE_BOMB, ACTION, DETONATE, SURRENDER, etc.)
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

      // Materialize movement intent into queues before snapshot
      for (const pid of Object.keys(this.queues)) {
        const intent = this.intents[pid];
        if (!intent) continue;
        if (intent.pendingDirection) {
          this.queues[pid]!.push({ type: "MOVE", direction: intent.pendingDirection });
          intent.pendingDirection = null;
        } else if (intent.activeDirection) {
          const player = this.state.players[pid];
          const speed = player?.speed ?? 1;
          const steps = Math.max(1, speed);
          for (let i = 0; i < steps; i++) {
            this.queues[pid]!.push({ type: "MOVE", direction: intent.activeDirection });
          }
        }
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

      // No direction re-injection — intents are materialized each tick above

      for (const cb of this.onTickCallbacks) {
        try {
          cb(this.state);
        } catch {}
      }

      if (this.state.status === GameStatus.Ended) {
        this.clearTickTimer();
        this.triggerEnd();
      }
    }, intervalMs);
  }

  stopTicking(): void {
    this.clearTickTimer();
  }

  private clearTickTimer(): void {
    const tickTimerId = this.tickTimerId;
    this.tickTimerId = null;

    if (tickTimerId !== null) {
      clearInterval(tickTimerId);
    }
  }

  /** Stop movement for a player — clears both active and pending direction without changing confirmation. */
  stopMovement(pid: PlayerId): void {
    const intent = this.intents[pid];
    if (intent) {
      intent.activeDirection = null;
      intent.pendingDirection = null;
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
