/// <reference types="@solidjs/start/env" />
declare module "*.css";

interface Window {
  __test__?: {
    roomId: string | null;
    getGameState(): Record<string, unknown> | null;
    getConnectionState(): "connecting" | "connected" | "reconnecting" | "disconnected" | null;
    waitForStatus(status: string, timeout?: number): Promise<void>;
    waitForWSConnected(timeout?: number): Promise<void>;
  };
}
