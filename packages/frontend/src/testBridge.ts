import type { SyncedGameState } from "@generale/types";
import type { ClientConnectionManager, WSOpenPayloadBase } from "./ws/manager";

export interface TestBridge {
  gameState: SyncedGameState | null;
  roomId: string | null;
  wsManager: ClientConnectionManager<WSOpenPayloadBase> | null;
}

const bridge: TestBridge = {
  gameState: null,
  roomId: null,
  wsManager: null,
};

export default bridge;
