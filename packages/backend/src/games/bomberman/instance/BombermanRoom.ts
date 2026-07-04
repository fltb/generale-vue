import {
  BombermanPreGameServerEventType,
  type BombermanConfig,
  type BombermanPreGameClientAction,
  type BombermanPreGameServerEvent,
  type BombermanRoomPlayer,
  type BombermanRoomState,
  type BombermanRoomPhase,
  type PlayerId,
  type ServerSyncConnector,
  type SyncedStateServerEvent,
  SyncedStateServerEventType,
} from "@generale/types";
import { StateSyncState } from "../../../game/instance/state-sync";

export type BombermanRoomConnector = ServerSyncConnector<
  BombermanPreGameClientAction,
  SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent>
>;

export class BombermanRoom {
  private state: BombermanRoomState;
  private connectors = new Map<PlayerId, BombermanRoomConnector>();
  private syncData = new Map<PlayerId, { lastConfirmedOp: number }>();
  private stateSync = new StateSyncState<BombermanRoomState>();
  private version = 0;
  private destroyed = false;
  private hostReclaimTimer: ReturnType<typeof setTimeout> | undefined;
  private creatorId: PlayerId;

  onGameStartCallback?: (playerIds: PlayerId[]) => void;
  onDisbandedCallback?: () => void;

  constructor(roomName: string, config: BombermanConfig, creatorId: PlayerId, _creatorName: string) {
    this.creatorId = creatorId;
    this.state = {
      roomName,
      config,
      phase: "lobby",
      maxPlayers: config.playerLimit,
      hostId: creatorId,
      players: [],
    };
  }

  onGameStart(cb: (playerIds: PlayerId[]) => void): void {
    this.onGameStartCallback = cb;
  }

  onDisbanded(cb: () => void): void {
    this.onDisbandedCallback = cb;
  }

  addPlayer(
    user: { id: PlayerId; name: string },
    connector: BombermanRoomConnector,
  ): { success: true } | { success: false; message: string } {
    if (this.destroyed) return { success: false, message: "Room destroyed" };

    const existing = this.state.players.find((p) => p.id === user.id);
    if (existing) {
      this.connectors.set(user.id, connector);
      this.wireConnector(user.id, connector);
      this.version++;
      this.sendState(user.id, true);
      return { success: true };
    }

    if (this.state.phase !== "lobby") return { success: false, message: "Game already in progress" };

    // First player must be the creator
    if (this.state.players.length === 0 && user.id !== this.creatorId) {
      return { success: false, message: "Only the room creator can join as the first player" };
    }

    if (this.state.players.length >= this.state.maxPlayers) {
      return { success: false, message: "Room is full" };
    }

    const isHost = this.state.players.length === 0;
    const player: BombermanRoomPlayer = { id: user.id, name: user.name, ready: false, isHost };
    this.state.players.push(player);
    this.connectors.set(user.id, connector);
    this.wireConnector(user.id, connector);
    this.version++;
    this.broadcastState();
    return { success: true };
  }

  private wireConnector(pid: PlayerId, connector: BombermanRoomConnector): void {
    connector.onOpen(() => this.sendState(pid, true));
    connector.onDisconnect(() => this.handleDisconnect(pid, connector));
    connector.onReconnect(() => this.sendState(pid, true));
    connector.onClientMessage((evt) => this.handleClientAction(pid, evt));
    connector.onClose(() => this.handleClose(pid));
  }

  private handleDisconnect(pid: PlayerId, connector: BombermanRoomConnector): void {
    const player = this.state.players.find((p) => p.id === pid);
    if (!player) return;
    if (this.connectors.get(pid) !== connector) return;

    if (this.state.phase === "playing") {
      player.ready = false;
      this.version++;
      this.broadcastState();
      return;
    }

    if (player.isHost) {
      this.hostReclaimTimer = setTimeout(() => this.transferHost(), 5000);
    } else {
      this.removePlayer(pid);
    }
    this.version++;
    this.broadcastState();
  }

  private handleClose(pid: PlayerId): void {
    if (this.hostReclaimTimer) {
      clearTimeout(this.hostReclaimTimer);
      this.hostReclaimTimer = undefined;
    }
    this.removePlayer(pid);
  }

  private removePlayer(pid: PlayerId): void {
    this.state.players = this.state.players.filter((p) => p.id !== pid);
    this.connectors.delete(pid);
    this.syncData.delete(pid);
    this.stateSync.clear(pid);

    if (this.state.players.length === 0) {
      this.state.phase = "disbanded";
      this.destroyed = true;
      if (this.onDisbandedCallback) this.onDisbandedCallback();
      return;
    }

    if (pid === this.state.hostId) {
      this.transferHost();
    }
    this.version++;
    this.broadcastState();
  }

  private transferHost(): void {
    if (this.state.players.length === 0) return;
    const next = this.state.players[0];
    if (!next) return;
    next.isHost = true;
    this.state.hostId = next.id;
    if (this.hostReclaimTimer) {
      clearTimeout(this.hostReclaimTimer);
      this.hostReclaimTimer = undefined;
    }
    this.version++;
    this.broadcastState();
  }

  private handleClientAction(pid: PlayerId, evt: BombermanPreGameClientAction): void {
    if (this.destroyed) return;
    const player = this.state.players.find((p) => p.id === pid);
    if (!player) return;

    let synced = this.syncData.get(pid);
    if (!synced) {
      synced = { lastConfirmedOp: 0 };
      this.syncData.set(pid, synced);
    }
    if (typeof evt.optimisticId === "number" && synced.lastConfirmedOp >= evt.optimisticId) return;

    switch (evt.type) {
      case "READY":
        player.ready = true;
        break;
      case "UNREADY":
        player.ready = false;
        break;
      case "CHANGE_CONFIG":
        if (!player.isHost) return;
        this.state.config = { ...this.state.config, ...evt.payload };
        break;
      case "KICK_PLAYER":
        if (!player.isHost) return;
        if (evt.targetId === pid) return;
        {
          const targetConn = this.connectors.get(evt.targetId);
          if (targetConn) {
            targetConn.send({ type: "custom", payload: { type: BombermanPreGameServerEventType.KICKED, reason: "Kicked by host" } } as any);
            targetConn.close();
          }
          this.removePlayer(evt.targetId);
        }
        break;
      case "START_GAME":
        if (!player.isHost) return;
        if (this.state.players.length < 2) return;
        if (!this.state.players.every((p) => p.ready)) return;
        this.state.phase = "playing";
        this.version++;
        this.onGameStartCallback?.(this.state.players.map((p) => p.id));
        for (const [, c] of this.connectors) {
          c.send({ type: "custom", payload: { type: BombermanPreGameServerEventType.GAME_STARTED, startedAt: Date.now() } } as any);
        }
        break;
    }

    if (typeof evt.optimisticId === "number") {
      synced.lastConfirmedOp = evt.optimisticId;
    }
    this.version++;
    this.broadcastState();
  }

  broadcastCustom(event: BombermanPreGameServerEvent): void {
    for (const [, c] of this.connectors) {
      try {
        c.send({ type: "custom", payload: event } as any);
      } catch {}
    }
  }

  resumeGame(): void {
    this.state.phase = "lobby";
    for (const p of this.state.players) {
      p.ready = false;
    }
    this.version++;
    this.broadcastState();
  }

  sendState(pid: PlayerId, forceSnapshot: boolean): void {
    const conn = this.connectors.get(pid);
    if (!conn) return;
    const confirmedOp = this.syncData.get(pid)?.lastConfirmedOp ?? 0;
    this.stateSync.send(
      pid,
      forceSnapshot,
      this.state,
      this.version,
      confirmedOp,
      (state, ver, op) =>
        conn.send({
          type: SyncedStateServerEventType.STATE_UPDATE,
          payload: { type: "snapshot", version: ver, confirmedOp: op, payload: state },
        } as any),
      () => {},
    );
  }

  broadcastState(): void {
    for (const pid of this.connectors.keys()) {
      this.sendState(pid, false);
    }
  }

  getState(): BombermanRoomState {
    return this.state;
  }
  getPhase(): BombermanRoomPhase {
    return this.state.phase;
  }
  getPlayers(): BombermanRoomPlayer[] {
    return this.state.players;
  }
  getPlayerIds(): PlayerId[] {
    return this.state.players.map((p) => p.id);
  }
  getConfig(): BombermanConfig {
    return this.state.config;
  }
  isDisbanded(): boolean {
    return this.destroyed || this.state.phase === "disbanded";
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.hostReclaimTimer) clearTimeout(this.hostReclaimTimer);
    for (const c of this.connectors.values()) c.close();
    this.connectors.clear();
  }
}
