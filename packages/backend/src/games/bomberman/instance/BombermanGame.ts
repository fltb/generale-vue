import type { BombermanState, BombermanOperation, BombermanPlayer, PlayerId, BombermanConfig, BombermanGameEndResult } from "@generale/types";
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
        this.queues[bot.playerId]?.push(action);
      }
      // tick() consumes ops from the persistent queue — only removes what was processed
      this.state = tick(this.state, this.queues);

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
