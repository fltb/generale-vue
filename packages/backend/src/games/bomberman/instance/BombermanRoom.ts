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
  SyncedGameServerEventType,
  SyncedStateServerEventType,
  SyncedStateServerStateUpdatePayloadType,
} from "@generale/types";
import { StateSyncState } from "../../../game/instance/state-sync";
import { displaceConnector } from "../../../game/instance/connector-manager";
import { validateBombermanConfig } from "../settings";

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
  private suspended = false;
  private hostReclaimTimer: ReturnType<typeof setTimeout> | undefined;
  private bannedPlayers = new Map<PlayerId, number>();
  private creatorId: PlayerId;
  private creatorName: string;
  private roomPassword: string | undefined;

  onGameStartCallback?: (playerIds: PlayerId[]) => void;
  onDisbandedCallback?: () => void;
  onStateChangeCallback?: () => void;

  constructor(roomName: string, config: BombermanConfig, creatorId: PlayerId, creatorName: string, password?: string) {
    this.creatorId = creatorId;
    this.creatorName = creatorName;
    this.roomPassword = password;
    this.state = {
      roomName,
      config,
      phase: "lobby",
      maxPlayers: config.playerLimit,
      hostId: creatorId,
      players: [],
    };
  }

  public getPassword(): string | undefined {
    return this.roomPassword;
  }

  public canJoin(playerId: PlayerId, password?: string): { success: true } | { success: false; message: string } {
    if (this.destroyed) return { success: false, message: "Room destroyed" };
    // Existing player can always rejoin
    const existing = this.state.players.find((p) => p.id === playerId);
    if (existing) return { success: true };
    // Ban check for kicked players
    const banExpiry = this.bannedPlayers.get(playerId);
    if (banExpiry && Date.now() < banExpiry) {
      return { success: false, message: "You are banned from this room" };
    }
    // First player (creator) skips password
    if (this.state.players.length === 0) return { success: true };
    // Password check for new players
    if (this.roomPassword && password !== this.roomPassword) {
      return { success: false, message: "Wrong password" };
    }
    if (this.state.phase !== "lobby") return { success: false, message: "Game already in progress" };
    if (this.state.players.length >= this.state.maxPlayers) return { success: false, message: "Room is full" };
    return { success: true };
  }

  onGameStart(cb: (playerIds: PlayerId[]) => void): void {
    this.onGameStartCallback = cb;
  }

  onDisbanded(cb: () => void): void {
    this.onDisbandedCallback = cb;
  }

  onStateChange(cb: () => void): void {
    this.onStateChangeCallback = cb;
  }

  addPlayer(
    user: { id: PlayerId; name: string; password?: string },
    connector: BombermanRoomConnector,
  ): { success: true } | { success: false; message: string } {
    const joinCheck = this.canJoin(user.id, user.password);
    if (!joinCheck.success) return joinCheck;

    const existing = this.state.players.find((p) => p.id === user.id);
    if (existing) {
      // If a disconnected host reconnects, cancel the reclaim timer
      if (this.hostReclaimTimer) {
        clearTimeout(this.hostReclaimTimer);
        this.hostReclaimTimer = undefined;
      }
      // Displacement pattern: write new connector first, then close old one.
      // This ensures the old connector's onClose source guard short-circuits.
      displaceConnector(
        user.id,
        connector,
        this.connectors,
        this.stateSync,
        this.syncData,
        SyncedGameServerEventType.CUSTOM,
        BombermanPreGameServerEventType.DISPLACED,
      );
      this.wireConnector(user.id, connector);
      this.version++;
      this.broadcastState();
      return { success: true };
    }

    // First player must be the creator
    if (this.state.players.length === 0 && user.id !== this.creatorId) {
      return { success: false, message: "Only the room creator can join as the first player" };
    }

    if (this.state.players.length >= this.state.maxPlayers) {
      return { success: false, message: "Room is full" };
    }

    const isHost = this.state.players.length === 0;
    const player: BombermanRoomPlayer = {
      id: user.id,
      name: isHost ? user.name || this.creatorName : user.name,
      ready: isHost,
      isHost,
    };
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
    connector.onClose(() => this.handleClose(pid, connector));
  }

  private handleDisconnect(pid: PlayerId, connector: BombermanRoomConnector): void {
    const player = this.state.players.find((p) => p.id === pid);
    if (!player) return;
    if (this.connectors.get(pid) !== connector) return;

    if (this.state.phase === "playing") {
      player.ready = false;
      this.version++;
      this.broadcastState();
      this.onStateChangeCallback?.();
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

  private handleClose(pid: PlayerId, source: BombermanRoomConnector): void {
    // Source guard: if this connector has been displaced, ignore the close
    if (this.connectors.get(pid) !== source) return;

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
    next.ready = true;
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

    // During suspend (game in progress), only allow spectate toggles
    if (this.suspended) {
      if (evt.type !== "ENTER_SPECTATE" && evt.type !== "LEAVE_SPECTATE") {
        if (typeof evt.optimisticId === "number") {
          synced.lastConfirmedOp = evt.optimisticId;
        }
        return;
      }
    }

    switch (evt.type) {
      case "READY":
        if (!player.isHost) player.ready = true;
        break;
      case "UNREADY":
        if (!player.isHost) player.ready = false;
        break;
      case "CHANGE_CONFIG":
        if (!player.isHost) return;
        {
          const err = validateBombermanConfig(evt.payload);
          if (err) return; // ignore invalid config
        }
        this.state.config = { ...this.state.config, ...evt.payload };
        break;
      case "KICK_PLAYER":
        if (!player.isHost) return;
        if (evt.targetId === pid) return;
        {
          this.bannedPlayers.set(evt.targetId, Date.now() + 60000);
          const targetConn = this.connectors.get(evt.targetId);
          if (targetConn) {
            targetConn.send({
              type: SyncedGameServerEventType.CUSTOM,
              payload: { type: BombermanPreGameServerEventType.KICKED, reason: "Kicked by host" },
            });
            targetConn.close();
          }
          this.removePlayer(evt.targetId);
        }
        break;
      case "DISBAND_ROOM":
        if (!player.isHost) return;
        this.disband();
        break;
      case "START_GAME": {
        if (!player.isHost) return;
        if (this.state.players.length < 2) return;
        if (!this.state.players.filter((p) => !p.isHost).every((p) => p.ready)) return;
        this.state.phase = "playing";
        this.suspend();
        this.version++;
        // Only include non-spectating players in the game
        const gamePlayerIds = this.state.players.filter((p) => p.status !== "spectating").map((p) => p.id);
        this.onGameStartCallback?.(gamePlayerIds);
        for (const [, c] of this.connectors) {
          c.send({
            type: SyncedGameServerEventType.CUSTOM,
            payload: { type: BombermanPreGameServerEventType.GAME_STARTED, startedAt: Date.now() },
          });
        }
        break;
      }
      case "ENTER_SPECTATE":
        if (this.state.phase !== "playing") return;
        player.status = "spectating";
        player.ready = false;
        break;
      case "LEAVE_SPECTATE":
        if (this.state.phase !== "playing") return;
        player.status = "lobby";
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
        c.send({ type: SyncedGameServerEventType.CUSTOM, payload: event });
      } catch {}
    }
  }

  suspend(): void {
    if (this.suspended) return;
    this.suspended = true;
    this.stateSync.clearAll();
  }

  resumeGame(): void {
    this.suspended = false;
    this.state.phase = "lobby";
    for (const p of this.state.players) {
      if (!p.isHost) p.ready = false;
    }
    this.version++;
    this.broadcastState();
  }

  /** Disband the room — closes all connectors and fires disbanded callback */
  private disband(): void {
    this.destroyed = true;
    this.state.phase = "disbanded";
    if (this.hostReclaimTimer) {
      clearTimeout(this.hostReclaimTimer);
      this.hostReclaimTimer = undefined;
    }
    for (const [, c] of this.connectors) {
      try {
        c.send({
          type: SyncedGameServerEventType.CUSTOM,
          payload: { type: BombermanPreGameServerEventType.ROOM_DISBANDED, reason: "Room has been disbanded." },
        });
        c.close();
      } catch {
        // ignore send failures
      }
    }
    this.connectors.clear();
    this.onDisbandedCallback?.();
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
          payload: {
            type: SyncedStateServerStateUpdatePayloadType.SNAPSHOT,
            version: ver,
            confirmedOp: op,
            payload: state,
          },
        }),
      (patches, ver, op) =>
        conn.send({
          type: SyncedStateServerEventType.STATE_UPDATE,
          payload: {
            type: SyncedStateServerStateUpdatePayloadType.PATCH,
            version: ver,
            confirmedOp: op,
            payload: patches,
          },
        }),
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
    this.bannedPlayers.clear();
  }
}
