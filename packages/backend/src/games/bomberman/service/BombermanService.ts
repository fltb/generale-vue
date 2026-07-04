import type { BombermanConfig, GameId, BombermanPreGameClientAction, BombermanPreGameServerEvent, BombermanRoomState, SyncedStateServerEvent } from "@generale/types";
import { SyncedStateServerEventType } from "@generale/types";
import type { SubConnector } from "../../../plugins/websocket";
import { registerDomainHandler, unregisterDomainHandler } from "../../../plugins/websocket";
import { BombermanGame } from "../instance/BombermanGame";
import { BombermanRoom } from "../instance/BombermanRoom";

export class BombermanService {
  public gameId: GameId;
  public roomName: string;
  private room: BombermanRoom;
  private game: BombermanGame | null = null;
  private destroyed = false;
  private gameConnectors = new Map<string, SubConnector>();
  public onDisband?: () => void;

  constructor(gameId: GameId, roomName: string, config: BombermanConfig, creatorId: string, creatorName: string) {
    this.gameId = gameId;
    this.roomName = roomName;
    this.room = new BombermanRoom(roomName, config, creatorId, creatorName);
    this.room.onGameStart(() => this.startGame());
    this.room.onDisbanded(() => { this.onDisband?.(); });
  }

  registerHandlers(): void {
    registerDomainHandler<BombermanPreGameClientAction, SyncedStateServerEvent<BombermanRoomState, BombermanPreGameServerEvent>>(
      `room-${this.gameId}`,
      (connector) => {
        const { userid, username } = connector.context;
        if (!(userid && username)) {
          connector.close(4001, "Missing auth");
          return;
        }
        if (this.room.isDisbanded()) {
          connector.close(4004, "Room disbanded");
          return;
        }
        const result = this.room.addPlayer({ id: userid, name: username }, connector);
        if (!result.success) {
          connector.close(4003, result.message);
        }
      },
    );

    registerDomainHandler<Record<string, unknown>, Record<string, unknown>>(
      `game-${this.gameId}`,
      (connector) => {
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
        this.gameConnectors.set(userid, connector);
        connector.onClientMessage((evt) => {
          const e = evt as Record<string, unknown>;
          const op = {
            type: e["type"],
            ...(e["direction"] ? { direction: e["direction"] } : {}),
          } as unknown as import("@generale/types").BombermanOperation;
          g.handleAction(userid, op, e["optimisticId"] as number | undefined);
        });
        connector.onClose(() => this.gameConnectors.delete(userid));
        connector.send({
          type: SyncedStateServerEventType.STATE_UPDATE,
          payload: { type: "snapshot", version: g.getState().tick, payload: g.getState() },
        });
      },
    );

    registerDomainHandler(`chat-${this.gameId}`, () => {});
  }

  startGame(): void {
    const roomPlayers = this.room.getPlayers().map(p => ({ id: p.id, name: p.name }));
    const config = this.room.getConfig();
    this.game = new BombermanGame(config, roomPlayers);
    const g = this.game;

    g.onTick((state) => {
      for (const [, conn] of this.gameConnectors) {
        try {
          conn.send({
            type: SyncedStateServerEventType.STATE_UPDATE,
            payload: { type: "snapshot", version: state.tick, payload: state },
          });
        } catch {
          // ignore send failures
        }
      }
    });

    g.onEnd((result) => {
      const players = Object.values(result.state.players) as { playerId: string; name: string; alive: boolean }[];
      const rankings = players
        .sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? -1 : 1))
        .map((p, i) => ({ playerId: p.playerId, rank: i + 1 }));

      this.room.broadcastCustom({
        type: "gameended" as any,
        rankings,
        winnerId: result.winnerId,
      });

      this.room.resumeGame();

      g.destroy();
      this.game = null;
      this.gameConnectors.clear();
    });

    g.startTicking();
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
      data: { playerId: userid, phase, domains: { primary, game: `game-${this.gameId}`, chat: `chat-${this.gameId}` } },
    };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    unregisterDomainHandler(`room-${this.gameId}`);
    unregisterDomainHandler(`game-${this.gameId}`);
    unregisterDomainHandler(`chat-${this.gameId}`);
    this.room.destroy();
    this.game?.destroy();
    this.onDisband?.();
  }
}
