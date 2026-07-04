import type { BombermanState, BombermanOperation, BombermanPlayer, PlayerId, BombermanConfig } from "@generale/types";
import { GameStatus } from "@generale/types";
import { tick } from "../core/game";
import { generateBombermanMap, getSpawnPositions } from "../core/map-gen";

export interface BombermanGameEndResult {
  winnerId: PlayerId | null;
  reason: string;
  state: BombermanState;
}

export class BombermanGame {
  private state: BombermanState;
  private destroyed = false;
  private tickTimerId: ReturnType<typeof setInterval> | null = null;
  private onEndCallbacks: Array<(result: BombermanGameEndResult) => void> = [];
  private onTickCallbacks: Array<(state: BombermanState) => void> = [];
  private queues: Record<PlayerId, BombermanOperation[]> = {};
  private bots: Array<{ playerId: PlayerId; getAction: (state: BombermanState) => BombermanOperation }> = [];

  constructor(config: BombermanConfig, playerIds: PlayerId[]) {
    const width = config.mapWidth;
    const height = config.mapHeight;
    const map = generateBombermanMap(width, height);
    const spawns = getSpawnPositions(playerIds.length, width, height);

    const players: Record<string, BombermanPlayer> = {};
    for (let i = 0; i < playerIds.length; i++) {
      const spawn = spawns[i]!;
      const pid = playerIds[i]!;
      players[pid] = {
        playerId: pid, alive: true, x: spawn.x, y: spawn.y,
        bombMax: config.bombLimit, bombActive: 0, blastRadius: config.blastRadius,
        speed: 1, items: [],
      };
    }

    this.state = {
      status: GameStatus.Playing, tick: 0, map, players,
      bombs: [], explosions: [], items: [], config, bombIdCounter: 0,
    };

    for (const pid of playerIds) this.queues[pid] = [];
  }

  addBot(playerId: PlayerId, getAction: (state: BombermanState) => BombermanOperation): void {
    const spawns = getSpawnPositions(Object.keys(this.state.players).length + 1, this.state.config.mapWidth, this.state.config.mapHeight);
    const spawn = spawns[Object.keys(this.state.players).length]!;
    this.state.players[playerId] = {
      playerId, alive: true, x: spawn.x, y: spawn.y,
      bombMax: 1, bombActive: 0, blastRadius: 1, speed: 1, items: [],
    };
    this.bots.push({ playerId, getAction });
    this.queues[playerId] = [];
  }

  handleAction(pid: PlayerId, op: BombermanOperation, _optimisticId?: number): void {
    if (!this.queues[pid]) this.queues[pid] = [];
    this.queues[pid].push(op);
  }

  startTicking(): void {
    if (this.tickTimerId) return;
    const intervalMs = 1000 / this.state.config.tickRate;
    this.tickTimerId = setInterval(() => {
      for (const bot of this.bots) {
        const action = bot.getAction(this.state);
        if (!this.queues[bot.playerId]) this.queues[bot.playerId] = [];
        this.queues[bot.playerId]!.push(action);
      }
      this.state = tick(this.state, this.queues);
      for (const pid of Object.keys(this.queues)) this.queues[pid] = [];

      for (const cb of this.onTickCallbacks) {
        try { cb(this.state); } catch {}
      }

      if (this.state.status === GameStatus.Ended) {
        this.stopTicking();
        this.triggerEnd();
      }
    }, intervalMs);
  }

  stopTicking(): void {
    if (this.tickTimerId) { clearInterval(this.tickTimerId); this.tickTimerId = null; }
  }

  getState(): BombermanState { return this.state; }

  onTick(cb: (state: BombermanState) => void): void { this.onTickCallbacks.push(cb); }

  private triggerEnd(): void {
    const alive = Object.values(this.state.players).filter((p) => p.alive);
    const result: BombermanGameEndResult = {
      winnerId: alive.length === 1 ? alive[0]!.playerId : null,
      reason: alive.length <= 1 ? "last_alive" : "timeout",
      state: this.state,
    };
    for (const cb of this.onEndCallbacks) cb(result);
  }

  onEnd(cb: (result: BombermanGameEndResult) => void): void { this.onEndCallbacks.push(cb); }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopTicking();
    this.onEndCallbacks = [];
    this.onTickCallbacks = [];
  }
}
