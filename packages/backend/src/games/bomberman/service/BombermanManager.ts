import { BombermanService } from "./BombermanService";
import { registerDomainHandler } from "../../../plugins/websocket";
import { defaultBombermanConfig } from "../settings";
import type { SubConnector, WSContextBase } from "../../../plugins/websocket";

export enum LobbyServerMessageType {
  LIST = "LOBBY_LIST",
  CREATED = "LOBBY_CREATED",
  UPDATED = "LOBBY_UPDATED",
  DELETED = "LOBBY_DELETED",
}

export class BombermanManager {
  private services = new Map<string, BombermanService>();
  private lobbyConnectors: SubConnector[] = [];

  private roomCreatedCallbacks: Array<(roomId: string) => void> = [];
  private roomUpdatedCallbacks: Array<(roomId: string) => void> = [];
  private roomDeletedCallbacks: Array<(roomId: string) => void> = [];

  constructor() {
    registerDomainHandler<unknown, { type: string; payload: unknown }>("lobby-bomberman", (connector) => {
      const ctx = connector.context as WSContextBase;
      if (!ctx.userid) {
        connector.close(4001, "Not authenticated");
        return;
      }
      this.lobbyConnectors.push(connector);

      // Send initial full list
      connector.send({ type: LobbyServerMessageType.LIST, payload: this.getRoomListSummary() });

      // Subscribe to incremental updates
      const unsubCreated = this.onRoomCreated((id) => {
        const info = this.getGame(id)?.getSummary();
        if (!info) return;
        connector.send({ type: LobbyServerMessageType.CREATED, payload: info });
      });
      const unsubUpdated = this.onRoomUpdated((id) => {
        const info = this.getGame(id)?.getSummary();
        if (!info) return;
        connector.send({ type: LobbyServerMessageType.UPDATED, payload: info });
      });
      const unsubDeleted = this.onRoomDeleted((id) => {
        connector.send({ type: LobbyServerMessageType.DELETED, payload: { id } });
      });

      connector.onClose(() => {
        const idx = this.lobbyConnectors.indexOf(connector);
        if (idx >= 0) this.lobbyConnectors.splice(idx, 1);
        unsubCreated();
        unsubUpdated();
        unsubDeleted();
      });
    });
  }

  // subscribe helpers — return unsubscribe function
  public onRoomCreated(cb: (roomId: string) => void): () => void {
    this.roomCreatedCallbacks.push(cb);
    return () => {
      const i = this.roomCreatedCallbacks.indexOf(cb);
      if (i >= 0) this.roomCreatedCallbacks.splice(i, 1);
    };
  }
  public onRoomUpdated(cb: (roomId: string) => void): () => void {
    this.roomUpdatedCallbacks.push(cb);
    return () => {
      const i = this.roomUpdatedCallbacks.indexOf(cb);
      if (i >= 0) this.roomUpdatedCallbacks.splice(i, 1);
    };
  }
  public onRoomDeleted(cb: (roomId: string) => void): () => void {
    this.roomDeletedCallbacks.push(cb);
    return () => {
      const i = this.roomDeletedCallbacks.indexOf(cb);
      if (i >= 0) this.roomDeletedCallbacks.splice(i, 1);
    };
  }

  private notifyRoomCreated(roomId: string) {
    for (const cb of this.roomCreatedCallbacks) {
      try {
        cb(roomId);
      } catch (err) {
        console.error("[BombermanManager] notifyRoomCreated error", err);
      }
    }
  }
  private notifyRoomUpdated(roomId: string) {
    for (const cb of this.roomUpdatedCallbacks) {
      try {
        cb(roomId);
      } catch (err) {
        console.error("[BombermanManager] notifyRoomUpdated error", err);
      }
    }
  }
  private notifyRoomDeleted(roomId: string) {
    for (const cb of this.roomDeletedCallbacks) {
      try {
        cb(roomId);
      } catch (err) {
        console.error("[BombermanManager] notifyRoomDeleted error", err);
      }
    }
  }

  createGame(
    roomName: string,
    creatorId: string,
    creatorName: string,
    password?: string,
    configOverride?: Record<string, unknown>,
  ): BombermanService {
    const id = `bomb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const defaultConfig = defaultBombermanConfig();
    const config = { ...defaultConfig, ...configOverride };
    const service = new BombermanService(id, roomName, config, creatorId, creatorName, password);
    service.onDisband = () => {
      this.removeGame(id);
    };
    service.onLobbyUpdate = () => {
      this.broadcastLobbyUpdate();
    };
    service.setRoomUpdateEmitter((gameId) => {
      this.notifyRoomUpdated(gameId);
    });
    service.registerHandlers();
    this.services.set(id, service);
    this.broadcastLobbyUpdate();
    this.notifyRoomCreated(id);
    return service;
  }

  getGame(id: string): BombermanService | undefined {
    return this.services.get(id);
  }

  removeGame(id: string): void {
    const service = this.services.get(id);
    if (service) {
      service.destroy();
      this.services.delete(id);
      this.broadcastLobbyUpdate();
      this.notifyRoomDeleted(id);
    }
  }

  getRoomListSummary() {
    const result = [];
    for (const svc of this.services.values()) {
      result.push(svc.getSummary());
    }
    return result;
  }

  broadcastLobbyUpdate(): void {
    const list = this.getRoomListSummary();
    for (const conn of this.lobbyConnectors) {
      try {
        conn.send({ type: "ROOM_LIST_UPDATE", payload: list });
      } catch {
        // ignore
      }
    }
  }
}
