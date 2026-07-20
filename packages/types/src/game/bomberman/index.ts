import type { GameStatus } from "../core-type";

export type ItemType = "BOMB_UP" | "FIRE_UP" | "SPEED_UP" | "KICK" | "GLOVE" | "PUNCH" | "REMOTE" | "PIERCE" | "SPIRIT";
export type BombermanDirection = "up" | "down" | "left" | "right";

export interface BombermanTile {
  type: "empty" | "hard_wall" | "soft_wall";
}

export interface BombermanMap {
  width: number;
  height: number;
  tiles: BombermanTile[][];
}

export interface BombermanPlayer {
  playerId: string;
  name: string;
  alive: boolean;
  x: number;
  y: number;
  bombMax: number;
  bombActive: number;
  blastRadius: number;
  speed: number;
  items: ItemType[];
  facing: BombermanDirection;
  carriedBomb?: string;
}

export interface Bomb {
  id: string;
  playerId: string;
  x: number;
  y: number;
  fuse: number;
  blastRadius: number;
  airborne?: boolean;
}

export interface Explosion {
  x: number;
  y: number;
  ttl: number;
}

export interface Item {
  x: number;
  y: number;
  type: ItemType;
}

export interface BombermanConfig {
  mapWidth: number;
  mapHeight: number;
  playerLimit: number;
  tickRate: number;
  bombFuse: number;
  bombLimit: number;
  blastRadius: number;
  roundTimeSec: number;
  shrinkEnabled: boolean;
  itemDropRate: number;
  items: ItemType[];
}

export interface BombermanState {
  status: GameStatus;
  tick: number;
  map: BombermanMap;
  players: Record<string, BombermanPlayer>;
  bombs: Bomb[];
  explosions: Explosion[];
  items: Item[];
  config: BombermanConfig;
  roundTimer?: number;
  shrinkBoundary?: number;
  bombIdCounter?: number;
  carriedBombs?: Record<string, Bomb>;
}

export type BombermanOperation =
  | { type: "MOVE"; direction: BombermanDirection; optimisticId?: number }
  | { type: "SET_DIRECTION"; direction: BombermanDirection | null; optimisticId?: number }
  | { type: "PLACE_BOMB"; optimisticId?: number }
  | { type: "ACTION"; optimisticId?: number }
  | { type: "DETONATE"; optimisticId?: number }
  | { type: "SURRENDER"; optimisticId?: number }
  | { type: "NOOP"; optimisticId?: number };

// ─── PreGame Types ───

export type BombermanRoomPhase = "lobby" | "playing" | "disbanded";

export interface BombermanRoomPlayer {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
  color?: number;
  status?: "lobby" | "spectating";
}

export interface BombermanRoomState {
  roomName: string;
  players: BombermanRoomPlayer[];
  config: BombermanConfig;
  phase: BombermanRoomPhase;
  maxPlayers: number;
  hostId: string;
}

export type BombermanPreGameClientAction =
  | { type: "READY"; optimisticId: number }
  | { type: "UNREADY"; optimisticId: number }
  | { type: "CHANGE_CONFIG"; optimisticId: number; payload: Partial<BombermanConfig> }
  | { type: "KICK_PLAYER"; optimisticId: number; targetId: string }
  | { type: "START_GAME"; optimisticId: number }
  | { type: "DISBAND_ROOM"; optimisticId: number }
  | { type: "ENTER_SPECTATE"; optimisticId: number }
  | { type: "LEAVE_SPECTATE"; optimisticId: number };

/** Dispatch-friendly version — same as above without optimisticId (useSyncedState auto-generates it).
 *  Explicit union avoids TypeScript Omit not distributing over discriminated unions. */
export type BombermanPreGameClientDispatch =
  | { type: "READY" }
  | { type: "UNREADY" }
  | { type: "CHANGE_CONFIG"; payload: Partial<BombermanConfig> }
  | { type: "KICK_PLAYER"; targetId: string }
  | { type: "START_GAME" }
  | { type: "DISBAND_ROOM" }
  | { type: "ENTER_SPECTATE" }
  | { type: "LEAVE_SPECTATE" };

export enum BombermanPreGameServerEventType {
  KICKED = "kicked",
  GAME_STARTED = "gamestarted",
  GAME_ENDED = "gameended",
  ROOM_DISBANDED = "disbanded",
  DISPLACED = "displaced",
}

export type BombermanPreGameServerEvent =
  | { type: BombermanPreGameServerEventType.KICKED; reason?: string }
  | { type: BombermanPreGameServerEventType.GAME_STARTED; startedAt: number }
  | {
      type: BombermanPreGameServerEventType.GAME_ENDED;
      rankings: { playerId: string; name: string; rank: number }[];
      winnerId: string | null;
    }
  | { type: BombermanPreGameServerEventType.ROOM_DISBANDED; reason?: string }
  | { type: BombermanPreGameServerEventType.DISPLACED; reason?: string };

export interface BombermanConnectResponse {
  playerId: string;
  phase: string;
  hasPassword?: boolean;
  domains: {
    primary: string;
    game: string;
    chat: string;
  };
}

export interface BombermanGameEndResult {
  winnerId: string | null;
  reason: string;
  state: BombermanState;
}
