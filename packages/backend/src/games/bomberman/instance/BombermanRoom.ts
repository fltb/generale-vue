import type { Operation } from "fast-json-patch";
import {
  BombermanPreGameServerEventType,
  PreGamePlayerStatus,
  VALID_BOMBERMAN_SKIN_IDS,
  createBombermanMatchState,
  type BombermanConfig,
  type BombermanPreGameClientAction,
  type BombermanPreGameServerEvent,
  type BombermanRoomSpectator,
  type BombermanRoomPlayer,
  type BombermanRoomState,
  type BombermanRoomPhase,
  type PlayerId,
  type TeamId,
  type ServerSyncConnector,
  type SyncedStateServerEvent,
  SyncedGameServerEventType,
  SyncedStateServerEventType,
  SyncedStateServerStateUpdatePayloadType,
  type PreGameTeamMode,
} from "@generale/types";
import type { ChatSenderMeta } from "@generale/types";
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

  onGameStartCallback?: (playerIds: PlayerId[], startedAt: number) => void;
  onDisbandedCallback?: () => void;
  onStateChangeCallback?: () => void;
  onSpectatorChangeCallback?: (action: "joined" | "left", spectator: { id: PlayerId; name: string }) => void;

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
      match: createBombermanMatchState(config.matchFormat),
      teams: [],
      spectators: [],
    };
  }

  /**
   * Ensure the teams array matches the current config.teamMode and players.
   * - FFA: each player gets a unique team (team1..teamN).
   * - Team: use team1/team2 with fixed manifests.
   * Existing teamId values are preserved when possible.
   */
  private ensureTeams(): void {
    const config = this.state.config;
    const teamMode: PreGameTeamMode = config.teamMode ?? "ffa";

    if (teamMode === "team") {
      this.state.teams = [
        { id: "team1", name: "Team Alpha", color: 0x3b82f6, marker: "circle" },
        { id: "team2", name: "Team Beta", color: 0xef4444, marker: "triangle" },
      ];
      // Assign unassigned or wrong-mode teamId players to team1/team2, balancing as best we can
      const team1Count = this.state.players.filter((p) => p.teamId === "team1").length;
      const team2Count = this.state.players.filter((p) => p.teamId === "team2").length;
      for (const p of this.state.players) {
        if (p.teamId === "team1" || p.teamId === "team2") continue;
        // Assign to smaller team, or team1 if equal
        if (team1Count <= team2Count) {
          (p as BombermanRoomPlayer).teamId = "team1";
        } else {
          (p as BombermanRoomPlayer).teamId = "team2";
        }
      }
    } else {
      // FFA: each player gets a unique team (team1..teamN), keep existing or assign by slot
      const knownTeams = new Set<TeamId>();
      for (let i = 0; i < this.state.players.length; i++) {
        const p = this.state.players[i];
        if (!p) continue;
        if (p.teamId && knownTeams.has(p.teamId)) {
          p.teamId = `team${i + 1}` as TeamId;
        }
        knownTeams.add(p.teamId);
      }
      this.state.teams = this.state.players.map((p, i) => ({
        id: p.teamId,
        name: p.name,
        color: [0x3b82f6, 0xef4444, 0x22c55e, 0xa855f7][i] ?? 0x888888,
        marker: (["circle", "triangle", "square", "diamond"] as const)[i] ?? "circle",
      }));
    }
  }

  public getPassword(): string | undefined {
    return this.roomPassword;
  }

  /** IRoomRoster: Get chat sender metadata for a player. */
  public getPlayerChatMeta(playerId: PlayerId): ChatSenderMeta | null {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return null;
    const team = this.state.teams.find((t) => t.id === player.teamId);
    return {
      teamId: player.teamId,
      teamName: team?.name ?? player.teamId,
      status: (player.status === "spectating"
        ? PreGamePlayerStatus.Lobby
        : (player.status ?? PreGamePlayerStatus.Lobby)) as PreGamePlayerStatus,
      presence: "room",
    };
  }

  /** IRoomRoster: Get player list for team-scoped chat. */
  public getPlayersForTeamChat(): Array<{ id: PlayerId; teamId?: TeamId; status: string }> {
    return Array.from(this.getPlayers(), ({ id, teamId, status = "lobby" }) => ({ id, teamId, status }));
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
    if (this.state.players.length >= this.state.maxPlayers - this.state.config.botCount)
      return { success: false, message: "Room is full" };
    return { success: true };
  }

  onGameStart(cb: (playerIds: PlayerId[], startedAt: number) => void): void {
    this.onGameStartCallback = cb;
  }

  onDisbanded(cb: () => void): void {
    this.onDisbandedCallback = cb;
  }

  onStateChange(cb: () => void): void {
    this.onStateChangeCallback = cb;
  }

  onSpectatorChange(cb: (action: "joined" | "left", spectator: { id: PlayerId; name: string }) => void): void {
    this.onSpectatorChangeCallback = cb;
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
      teamId: `team${this.state.players.length + 1}`,
    };
    this.state.players.push(player);
    this.ensureTeams();
    this.connectors.set(user.id, connector);
    this.wireConnector(user.id, connector);
    this.version++;
    this.broadcastState();
    return { success: true };
  }
  // ── Spectator management ──
  addSpectator(
    user: { id: PlayerId; name: string; password?: string },
    connector: BombermanRoomConnector,
  ): { success: true } | { success: false; message: string } {
    if (this.destroyed) return { success: false, message: "Room destroyed" };
    const existing = this.state.spectators.find((s) => s.id === user.id);
    if (existing) {
      // Reconnecting spectator — displace old connector
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
    // Password check for new spectators
    if (this.roomPassword && user.password !== this.roomPassword) {
      return { success: false, message: "Wrong password" };
    }
    // Spectators can always join (no player limit), even during playing/between_rounds
    this.state.spectators.push({
      id: user.id,
      name: user.name,
      joinedAt: Date.now(),
    });
    this.connectors.set(user.id, connector);
    this.wireConnector(user.id, connector);
    this.version++;
    this.broadcastState();
    this.onSpectatorChangeCallback?.("joined", { id: user.id, name: user.name });
    return { success: true };
  }
  removeSpectator(pid: PlayerId): void {
    const spectator = this.state.spectators.find((s) => s.id === pid);
    this.state.spectators = this.state.spectators.filter((s) => s.id !== pid);
    this.connectors.delete(pid);
    this.syncData.delete(pid);
    this.stateSync.clear(pid);
    this.version++;
    this.broadcastState();
    if (spectator) {
      this.onSpectatorChangeCallback?.("left", { id: spectator.id, name: spectator.name });
    }
  }

  getSpectators(): BombermanRoomSpectator[] {
    return this.state.spectators;
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

    if (this.state.phase === "playing" || this.state.phase === "between_rounds") {
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

    // During a round or the between-rounds countdown, keep the player in the
    // roster so an authenticated participant can reconnect to the room domain.
    // New players remain blocked by canJoin while the phase is not lobby.
    if (this.state.phase === "playing" || this.state.phase === "between_rounds") {
      this.connectors.delete(pid);
      return;
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
          // Reject botCount change that would overflow human slots
          if ("botCount" in evt.payload) {
            const newBotCount = evt.payload.botCount;
            if (typeof newBotCount !== "number") return;
            const humanCount = this.state.players.length;
            const effectiveLimit = this.state.maxPlayers - newBotCount;
            if (humanCount > effectiveLimit) return;
          }
        }
        this.state.config = { ...this.state.config, ...evt.payload };
        this.ensureTeams();
        break;
      case "CHANGE_TEAM_MODE":
        if (!player.isHost) return;
        this.state.config = { ...this.state.config, teamMode: evt.teamMode };
        this.ensureTeams();
        break;
      case "CHANGE_TEAM": {
        const targetPid = evt.playerId;
        const targetTeamId = evt.teamId;
        const config = this.state.config;
        const teamMode: PreGameTeamMode = config.teamMode ?? "ffa";

        if (teamMode === "team") {
          // Team mode: host moves any player, player moves self. Only team1/team2.
          if (targetTeamId !== "team1" && targetTeamId !== "team2") return;
          if (pid !== targetPid && !player.isHost) return;
        } else {
          // FFA: only self switch, each player gets a unique team slot
          if (pid !== targetPid) return;
          // FFA should stay compact — allow move to any team1..team4 not taken
          if (targetTeamId < "team1" || targetTeamId > "team4") return;
          if (this.state.players.some((p) => p.id !== targetPid && p.teamId === targetTeamId)) return;
        }

        const target = this.state.players.find((p) => p.id === targetPid);
        if (!target) return;
        target.teamId = targetTeamId;
        this.ensureTeams();
        break;
      }
      case "CHANGE_APPEARANCE": {
        const resolvedSkinId = VALID_BOMBERMAN_SKIN_IDS[evt.skinId] ? evt.skinId : "classic-blue";
        player.skinId = resolvedSkinId;
        break;
      }
      case "DISBAND_ROOM":
        if (!player.isHost) return;
        this.disband();
        break;
      case "START_GAME": {
        if (!player.isHost) {
          this.sendCustomTo(pid, { type: BombermanPreGameServerEventType.START_REJECTED, reason: "NOT_HOST" });
          if (typeof evt.optimisticId === "number") synced.lastConfirmedOp = evt.optimisticId;
          return;
        }
        if (this.state.phase !== "lobby") {
          if (typeof evt.optimisticId === "number") synced.lastConfirmedOp = evt.optimisticId;
          return;
        }
        const totalCompetitors = this.state.players.length + this.state.config.botCount;
        if (totalCompetitors < 2) {
          this.sendCustomTo(pid, {
            type: BombermanPreGameServerEventType.START_REJECTED,
            reason: "INVALID_PLAYER_COUNT",
          });
          if (typeof evt.optimisticId === "number") synced.lastConfirmedOp = evt.optimisticId;
          return;
        }
        if (!this.state.players.filter((p) => !p.isHost).every((p) => p.ready)) {
          this.sendCustomTo(pid, { type: BombermanPreGameServerEventType.START_REJECTED, reason: "PLAYERS_NOT_READY" });
          if (typeof evt.optimisticId === "number") synced.lastConfirmedOp = evt.optimisticId;
          return;
        }
        // ── Team balance validation ──
        if (this.state.config.teamMode === "team") {
          const team1Count = this.state.players.filter((p) => p.teamId === "team1").length;
          const team2Count = this.state.players.filter((p) => p.teamId === "team2").length;
          if (team1Count < 1 || team2Count < 1 || Math.abs(team1Count - team2Count) > 1) {
            this.sendCustomTo(pid, {
              type: BombermanPreGameServerEventType.START_REJECTED,
              reason: "INVALID_TEAMS",
            });
            if (typeof evt.optimisticId === "number") synced.lastConfirmedOp = evt.optimisticId;
            return;
          }
        }
        this.state.phase = "playing";
        this.suspend();
        this.version++;
        // Only include non-spectating players in the game
        const gamePlayerIds = this.state.players.filter((p) => p.status !== "spectating").map((p) => p.id);
        const startedAt = Date.now() + 3000;
        this.onGameStartCallback?.(gamePlayerIds, startedAt);
        for (const [, c] of this.connectors) {
          c.send({
            type: SyncedGameServerEventType.CUSTOM,
            payload: { type: BombermanPreGameServerEventType.ROUND_STARTED, startedAt, match: this.state.match },
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
      case "KICK_PLAYER": {
        if (!player.isHost) return;
        if (pid === evt.targetId) return;
        const target = this.state.players.find((p) => p.id === evt.targetId);
        if (!target) return;

        // Ban kicked player (5 minutes) to prevent immediate rejoin
        this.bannedPlayers.set(evt.targetId, Date.now() + 5 * 60 * 1000);

        // Close the connector which triggers handleClose → removePlayer
        const conn = this.connectors.get(evt.targetId);
        if (conn) conn.close();

        // Remove player from state — handles version++, broadcastState, host transfer
        this.removePlayer(evt.targetId);
        return;
      }
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

  sendCustomTo(pid: PlayerId, event: BombermanPreGameServerEvent): void {
    const conn = this.connectors.get(pid);
    if (!conn) return;
    try {
      conn.send({ type: SyncedGameServerEventType.CUSTOM, payload: event });
    } catch {}
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

  enterBetweenRounds(): void {
    this.state.phase = "between_rounds";
    this.suspended = true;
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

  private sendStateUpdate(
    conn: BombermanRoomConnector,
    ...[payloadType, version, confirmedOp, payload]:
      | [
          payloadType: SyncedStateServerStateUpdatePayloadType.SNAPSHOT,
          version: number,
          confirmedOp: number,
          payload: BombermanRoomState,
        ]
      | [
          payloadType: SyncedStateServerStateUpdatePayloadType.PATCH,
          version: number,
          confirmedOp: number,
          payload: Operation[],
        ]
  ): void {
    if (payloadType === SyncedStateServerStateUpdatePayloadType.SNAPSHOT) {
      conn.send({
        type: SyncedStateServerEventType.STATE_UPDATE,
        payload: { type: payloadType, version, confirmedOp, payload },
      });
      return;
    }

    conn.send({
      type: SyncedStateServerEventType.STATE_UPDATE,
      payload: { type: payloadType, version, confirmedOp, payload },
    });
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
      (state, ver, op) => this.sendStateUpdate(conn, SyncedStateServerStateUpdatePayloadType.SNAPSHOT, ver, op, state),
      (patches, ver, op) => this.sendStateUpdate(conn, SyncedStateServerStateUpdatePayloadType.PATCH, ver, op, patches),
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
