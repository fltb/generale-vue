import type {
  BombermanConfig,
  BombermanOperation,
  BombermanState,
  ChatClientToServer,
  ChatServerToClient,
  GameId,
  BombermanPreGameClientAction,
  BombermanPreGameServerEvent,
  BombermanRoomState,
  ServerSyncConnector,
  SyncedStateServerEvent,
} from "@generale/types";
import { SyncedStateServerEventType, BombermanPreGameServerEventType } from "@generale/types";
import { registerDomainHandler, unregisterDomainHandler } from "../../../plugins/websocket";
import { GameChatInstance } from "../../../game/instance/GameChatInstance";
import { GameSyncManager } from "../../../game/instance/sync-manager";
import type { SyncConnector } from "../../../game/instance/sync-manager";
import { BombermanGame } from "../instance/BombermanGame";
import { BombermanRoom } from "../instance/BombermanRoom";

export class BombermanService {
  public gameId: GameId;
  public roomName: string;
  private room: BombermanRoom;
  private game: BombermanGame | null = null;
  private destroyed = false;
  private chat: GameChatInstance;

  // Sync layer: game-agnostic connector + patch/snapshot management
  private sync = new GameSyncManager<BombermanState>({
    send: {
      sendSnapshot: (conn, state, version, confirmedOp) =>
        conn.send({
          type: SyncedStateServerEventType.STATE_UPDATE,
          payload: { type: "snapshot", version, confirmedOp, payload: state },
        }),
      sendPatch: (conn, patches, version, confirmedOp) =>
        conn.send({
          type: SyncedStateServerEventType.STATE_UPDATE,
          payload: { type: "patch", version, confirmedOp, payload: patches },
        }),
    },
    customEventType: "CUSTOM" as never,
    displacedPayloadType: "DISPLACED" as never,
  });

  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  public onDisband?: () => void;
  public onLobbyUpdate?: () => void;
  private roomUpdateEmitter?: (gameId: string) => void;

  constructor(
    gameId: GameId,
    roomName: string,
    config: BombermanConfig,
    creatorId: string,
    creatorName: string,
    password?: string,
  ) {
    this.gameId = gameId;
    this.roomName = roomName;
    this.chat = new GameChatInstance();
    this.room = new BombermanRoom(roomName, config, creatorId, creatorName, password);
    this.room.onGameStart(() => this.startGame());
    this.room.onDisbanded(() => {
      this.onDisband?.();
    });
    this.room.onStateChange(() => {
      this.onLobbyUpdate?.();
      this.roomUpdateEmitter?.(this.gameId);
    });
  }

  registerHandlers(): void {
    registerDomainHandler<
      BombermanPreGameClientAction,
      SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent>
    >(`room-${this.gameId}`, (connector) => {
      const { userid, username } = connector.context;
      if (!(userid && username)) {
        connector.close(4001, "Missing auth");
        return;
      }
      if (this.room.isDisbanded()) {
        connector.close(4004, "Room disbanded");
        return;
      }
      const pw = connector.context.password;
      const userArgs: { id: string; name: string; password?: string } = { id: userid, name: username };
      if (pw) userArgs.password = pw;
      const result = this.room.addPlayer(userArgs, connector);
      if (!result.success) {
        connector.close(4003, result.message);
      }
    });

    registerDomainHandler<Record<string, unknown>, Record<string, unknown>>(`game-${this.gameId}`, (connector) => {
      const { userid } = connector.context;
      if (!userid) {
        connector.close(4001, "Missing auth");
        return;
      }
      if (!this.game) {
        connector.close(4002, "Game not started");
        return;
      }
      const g = this.game;

      // Delegate connector lifecycle to the game-agnostic sync manager
      this.sync.addPlayer(userid, connector as unknown as SyncConnector);

      // Clear any pending auto-surrender timer (player reconnected)
      const existingTimer = this.disconnectTimers.get(userid);
      if (existingTimer) clearTimeout(existingTimer);

      // Register action handler (game-specific — NOT in sync manager)
      connector.onClientMessage((evt) => {
        const e = evt as Record<string, unknown>;
        const op = {
          type: e["type"],
          ...(e["direction"] ? { direction: e["direction"] } : {}),
        } as unknown as BombermanOperation;
        g.handleAction(userid, op, e["optimisticId"] as number | undefined);
      });

      // Auto-surrender after 30s of disconnection
      connector.onClose(() => {
        const timer = setTimeout(() => {
          if (this.game && !this.sync.getPlayerConnector(userid)) {
            this.game.handleAction(userid, { type: "SURRENDER" });
          }
        }, 30000);
        this.disconnectTimers.set(userid, timer);
      });

      // Send initial snapshot via sync manager (patch/snapshot auto-detected)
      this.sync.sendToPlayer(userid, g.getState(), g.getState().tick, 0, true);
    });

    registerDomainHandler(`chat-${this.gameId}`, (connector) => {
      const { userid, username } = connector.context;
      if (!(userid && username)) {
        connector.close(4001, "Missing auth");
        return;
      }
      const res = this.chat.addPlayer(
        { id: userid, name: username },
        connector as unknown as ServerSyncConnector<ChatClientToServer, ChatServerToClient>,
      );
      if (!res.success) {
        connector.close(4003, res.message);
        return;
      }
    });
  }

  startGame(): void {
    const roomPlayers = this.room.getPlayers().map((p) => ({ id: p.id, name: p.name }));
    const config = this.room.getConfig();
    this.game = new BombermanGame(config, roomPlayers);
    const g = this.game;

    // Solo test bot
    if (roomPlayers.length === 1) {
      const botId = `bot-${this.gameId}`;
      const dirs: Array<"up" | "down" | "left" | "right"> = ["up", "down", "left", "right"];
      g.addBot(botId, () => {
        const roll = Math.random();
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        if (!dir) return { type: "NOOP" };
        if (roll < 0.7) return { type: "MOVE", direction: dir };
        if (roll < 0.85) return { type: "NOOP" };
        return { type: "PLACE_BOMB" };
      });
    }

    // Tick → broadcast per-player: each player gets their own confirmedOp
    // so the frontend can correctly prune its optimistic event queue
    g.onTick((state) => {
      const syncData = g.getSyncData();
      for (const pid of this.sync.getConnectedPlayerIds()) {
        const confirmedOp = syncData[pid]?.lastConfirmedOp ?? 0;
        this.sync.sendToPlayer(pid, state, state.tick, confirmedOp);
      }
    });

    // Game end: broadcast GAME_ENDED + cleanup
    g.onEnd((result) => {
      const players = Object.values(result.state.players) as { playerId: string; name: string; alive: boolean }[];
      const rankings = players
        .sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? -1 : 1))
        .map((p, i) => ({ playerId: p.playerId, name: p.name, rank: i + 1 }));

      this.room.broadcastCustom({
        type: BombermanPreGameServerEventType.GAME_ENDED,
        rankings,
        winnerId: result.winnerId,
      });

      this.room.resumeGame();

      for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
      this.disconnectTimers.clear();

      this.sync.destroy();
      g.destroy();
      this.game = null;
    });

    // 3-second pre-game delay for client countdown sync
    setTimeout(() => {
      g.startTicking();
    }, 3000);
  }

  public setRoomUpdateEmitter(cb: (gameId: string) => void) {
    this.roomUpdateEmitter = cb;
  }

  getPhase(): string {
    return this.room.getPhase();
  }

  getSummary() {
    const s = this.room.getState();
    return {
      gameId: this.gameId,
      roomName: s.roomName,
      playerCount: s.players.length,
      maxPlayers: s.maxPlayers,
      phase: s.phase,
      hostName: s.players.find((p) => p.isHost)?.name ?? "",
      hasPassword: !!this.room.getPassword(),
    };
  }

  getPlayerCount(): number {
    return this.room.getPlayers().length;
  }

  prepConnectionForPlayer(userid: string) {
    const phase = this.room.getPhase();
    const inRoom = this.room.getPlayers().some((p) => p.id === userid);
    const primary = phase === "playing" && inRoom ? `game-${this.gameId}` : `room-${this.gameId}`;
    return {
      success: true as const,
      data: {
        playerId: userid,
        phase,
        hasPassword: !!this.room.getPassword(),
        domains: { primary, game: `game-${this.gameId}`, chat: `chat-${this.gameId}` },
      },
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const timer of this.disconnectTimers.values()) clearTimeout(timer);
    this.disconnectTimers.clear();
    unregisterDomainHandler(`room-${this.gameId}`);
    unregisterDomainHandler(`game-${this.gameId}`);
    unregisterDomainHandler(`chat-${this.gameId}`);
    this.chat.destroy();
    this.room.destroy();
    this.sync.destroy();
    this.game?.destroy();
    this.onDisband?.();
  }
}
