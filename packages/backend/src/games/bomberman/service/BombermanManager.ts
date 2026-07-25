import { BombermanService } from "./BombermanService";
import { registerDomainHandler } from "../../../plugins/websocket";
import { defaultBombermanConfig, validateBombermanConfig } from "../settings";
import type { BombermanConfig } from "@generale/types";
import type { SubConnector, WSContextBase } from "../../../plugins/websocket";
import { LobbyServerMessageType } from "@generale/types";

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
    return this.subscribe(this.roomCreatedCallbacks, cb);
  }

  public onRoomUpdated(cb: (roomId: string) => void): () => void {
    return this.subscribe(this.roomUpdatedCallbacks, cb);
  }

  public onRoomDeleted(cb: (roomId: string) => void): () => void {
    return this.subscribe(this.roomDeletedCallbacks, cb);
  }

  private subscribe<T>(callbacks: T[], callback: T): () => void {
    callbacks.push(callback);
    return () => {
      const index = callbacks.indexOf(callback);
      if (index >= 0) callbacks.splice(index, 1);
    };
  }

  private notify<T>(callbacks: readonly ((value: T) => void)[], value: T, diagnosticMessage: string): void {
    callbacks.forEach((callback) => {
      this.notifyCallback(callback, value, diagnosticMessage);
    });
  }

  private notifyCallback<T>(callback: (value: T) => void, value: T, diagnosticMessage: string): void {
    try {
      callback(value);
    } catch (error) {
      console.error(diagnosticMessage, error);
    }
  }

  private notifyRoomCreated(roomId: string): void {
    this.notify(this.roomCreatedCallbacks, roomId, "[BombermanManager] notifyRoomCreated error");
  }

  private notifyRoomUpdated(roomId: string): void {
    this.notify(this.roomUpdatedCallbacks, roomId, "[BombermanManager] notifyRoomUpdated error");
  }

  private notifyRoomDeleted(roomId: string): void {
    this.notify(this.roomDeletedCallbacks, roomId, "[BombermanManager] notifyRoomDeleted error");
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
    if (configOverride && validateBombermanConfig(config) !== null) {
      throw new Error("Invalid Bomberman room config");
    }
    const matchFormat = config.matchFormat;
    if (matchFormat !== "single" && matchFormat !== "bo3" && matchFormat !== "bo5") {
      throw new Error("Invalid Bomberman match format");
    }
    const typedConfig: BombermanConfig = config;
    const service = new BombermanService(id, roomName, typedConfig, creatorId, creatorName, password);
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
