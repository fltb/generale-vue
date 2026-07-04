import { BombermanService } from "./BombermanService";
import { registerDomainHandler } from "../../../plugins/websocket";
import { defaultBombermanConfig } from "../settings";
import type { SubConnector, WSContextBase } from "../../../plugins/websocket";

export class BombermanManager {
  private services = new Map<string, BombermanService>();
  private lobbyConnectors: SubConnector[] = [];

  constructor() {
    registerDomainHandler<unknown, { type: string; payload: unknown }>("lobby-bomberman", (connector) => {
      const ctx = connector.context as WSContextBase;
      if (!ctx.userid) {
        connector.close(4001, "Not authenticated");
        return;
      }
      this.lobbyConnectors.push(connector);
      connector.onClose(() => {
        const idx = this.lobbyConnectors.indexOf(connector);
        if (idx >= 0) this.lobbyConnectors.splice(idx, 1);
      });
      connector.send({ type: "ROOM_LIST_UPDATE", payload: this.getRoomListSummary() });
    });
  }

  createGame(roomName: string, creatorId: string, creatorName: string): BombermanService {
    const id = `bomb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const config = defaultBombermanConfig();
    const service = new BombermanService(id, roomName, config, creatorId, creatorName);
    service.onDisband = () => { this.removeGame(id); };
    service.registerHandlers();
    this.services.set(id, service);
    this.broadcastLobbyUpdate();
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
