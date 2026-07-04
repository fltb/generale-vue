import type { BombermanConfig, GameId } from "@generale/types";
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

  constructor(gameId: GameId, roomName: string, config: BombermanConfig, creatorId: string, creatorName: string) {
    this.gameId = gameId;
    this.roomName = roomName;
    this.room = new BombermanRoom(roomName, config, creatorId, creatorName);
    this.room.onGameStart((_playerIds) => this.startGame());
  }

  registerHandlers(): void {
    registerDomainHandler(`room-${this.gameId}`, (connector: SubConnector) => {
      const ctx = connector.context as any;
      const userid: string | undefined = ctx.userid;
      const username: string | undefined = ctx.username;
      if (!userid || !username) { connector.close(4001, "Missing auth"); return; }
      if (this.room.isDisbanded()) { connector.close(4004, "Room disbanded"); return; }
      const result = this.room.addPlayer({ id: userid, name: username }, connector as any);
      if (!result.success) { connector.close(4003, result.message); }
    });

    registerDomainHandler(`game-${this.gameId}`, (connector: SubConnector) => {
      const ctx = connector.context as any;
      const userid: string | undefined = ctx.userid;
      if (!userid) { connector.close(4001, "Missing auth"); return; }
      if (!this.game) { connector.close(4002, "Game not started"); return; }
      this.gameConnectors.set(userid, connector);
      connector.onClientMessage((evt: any) => {
        this.game!.handleAction(userid, {
          type: evt.type,
          ...(evt.direction ? { direction: evt.direction as any } : {}),
        }, evt.optimisticId);
      });
      connector.onClose(() => this.gameConnectors.delete(userid));
      // Push current state immediately
      connector.send({
        type: "STATE_UPDATE",
        payload: { type: "snapshot", version: this.game!.getState().tick, payload: this.game!.getState() },
      });
    });

    registerDomainHandler(`chat-${this.gameId}`, () => {});
  }

  startGame(): void {
    const playerIds = this.room.getPlayerIds();
    const config = this.room.getConfig();
    this.game = new BombermanGame(config, playerIds);

    this.game.onTick((state) => {
      for (const [, conn] of this.gameConnectors) {
        try {
          conn.send({
            type: "STATE_UPDATE",
            payload: { type: "snapshot", version: state.tick, payload: state },
          });
        } catch {}
      }
    });

    this.game.onEnd((_result) => {
      this.game?.destroy();
      this.game = null;
      this.gameConnectors.clear();
    });

    this.game.startTicking();
  }

  getPhase(): string { return this.room.getPhase(); }

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

  getPlayerCount(): number { return this.room.getPlayers().length; }

  prepConnectionForPlayer(userid: string) {
    const phase = this.room.getPhase();
    const inRoom = this.room.getPlayers().some((p) => p.id === userid);
    const primary = (phase === "playing" && inRoom) ? `game-${this.gameId}` : `room-${this.gameId}`;
    return {
      success: true as const,
      data: {
        playerId: userid,
        phase,
        domains: { primary, game: `game-${this.gameId}`, chat: `chat-${this.gameId}` },
      },
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
  }
}
