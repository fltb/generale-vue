export type {
  BombermanSkinEntry,
  BombermanSkinId,
  BombermanThemeEntry,
  BombermanThemeId,
} from "./manifest";
export {
  BOMBERMAN_SKIN_MANIFEST,
  VALID_BOMBERMAN_SKIN_IDS,
  BOMBERMAN_THEME_MANIFEST,
  VALID_BOMBERMAN_THEME_IDS,
  BOMBERMAN_PRESET_DEFINITIONS,
} from "./manifest";
import type { GameStatus, PlayerId, TeamId } from "../core-type";
import type { PreGameTeamMode } from "../room/pre-game";

export type ItemType = "BOMB_UP" | "FIRE_UP" | "SPEED_UP" | "KICK" | "GLOVE" | "PUNCH" | "REMOTE" | "PIERCE" | "SPIRIT";
export type BombermanDirection = "up" | "down" | "left" | "right";

export interface BombermanTile {
  type: "empty" | "hard_wall" | "soft_wall";
}

export interface BombermanMapDefinition {
  schemaVersion: 1;
  width: number;
  height: number;
  themeId: string;
  tiles: BombermanTile[][];
  spawns: Array<{ x: number; y: number }>;
  fixedItems: Item[];
}

export type BombermanMap = BombermanMapDefinition;

export interface BombermanMapValidationIssue {
  code:
    | "INVALID_DIMENSIONS"
    | "INVALID_TILES"
    | "INVALID_SPAWNS"
    | "UNSAFE_SPAWN"
    | "DISCONNECTED"
    | "UNFAIR_PATHS"
    | "INVALID_WALL_DENSITY"
    | "UNBALANCED_ITEMS";
  path: string;
}

export type BombermanMatchFormat = "single" | "bo3" | "bo5";
export type BombermanBotDifficulty = "easy" | "normal" | "hard";
export type BombermanMapRef = { type: "preset"; id: "classic" | "sparse" | "dense" } | { type: "workshop"; id: string };
export type BombermanMapSource =
  | { type: "procedural"; themeId: string }
  | BombermanMapRef
  | { type: "rotation"; maps: BombermanMapRef[] };
export type BombermanWinner = { kind: "player"; id: PlayerId } | { kind: "team"; id: TeamId };

export interface BombermanRoundResult {
  roundNumber: number;
  attempt: number;
  winner: BombermanWinner | null;
  reason: "last_alive" | "timeout" | "draw";
  ticks: number;
}

export interface BombermanMatchState {
  format: BombermanMatchFormat;
  targetWins: 1 | 2 | 3;
  currentRound: number;
  currentAttempt: number;
  scores: Array<{ competitor: BombermanWinner; wins: number }>;
  roundResults: BombermanRoundResult[];
  winner: BombermanWinner | null;
  nextRoundStartsAt: number | null;
}

export interface BombermanMatchRanking {
  competitor: BombermanWinner;
  memberIds: PlayerId[];
  wins: number;
  rank: number;
}

export interface BombermanTeam {
  id: TeamId;
  name: string;
  color: number;
  marker: "circle" | "triangle" | "square" | "diamond";
}

export function createBombermanMatchState(format: BombermanMatchFormat): BombermanMatchState {
  return {
    format,
    targetWins: format === "single" ? 1 : format === "bo3" ? 2 : 3,
    currentRound: 1,
    currentAttempt: 1,
    scores: [],
    roundResults: [],
    winner: null,
    nextRoundStartsAt: null,
  };
}

export interface BombermanPlayer {
  playerId: PlayerId;
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
  teamId: TeamId;
  isBot: boolean;
  skinId: string;
  carriedBomb?: string;
}

export interface Bomb {
  id: string;
  playerId: PlayerId;
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
  bombId: string;
  ownerId: PlayerId;
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
  matchFormat: BombermanMatchFormat;
  teamMode: PreGameTeamMode;
  botCount: number;
  botDifficulty: BombermanBotDifficulty;
  mapSource: BombermanMapSource;
}

export interface BombermanInputIndicator {
  direction: BombermanDirection | null;
  action: "PLACE_BOMB" | "ACTION" | "DETONATE" | "SURRENDER" | null;
  actionTick: number | null;
}

interface BombermanEventBase {
  id: number;
  tick: number;
}

export type BombermanEvent =
  | (BombermanEventBase & {
      type: "elimination";
      victimId: PlayerId;
      killerId: PlayerId | null;
      bombId: string | null;
      cause: "bomb" | "shrink" | "surrender";
    })
  | (BombermanEventBase & { type: "item_picked_up"; playerId: PlayerId; item: ItemType })
  | (BombermanEventBase & { type: "item_spawned"; item: Item })
  | (BombermanEventBase & {
      type: "bomb_thrown";
      playerId: PlayerId;
      bombId: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    })
  | (BombermanEventBase & {
      type: "chain_triggered";
      sourceBombId: string;
      triggeredBombId: string;
      ownerId: PlayerId;
    });

export interface BombermanState {
  status: GameStatus;
  tick: number;
  map: BombermanMapDefinition;
  players: Record<PlayerId, BombermanPlayer>;
  bombs: Bomb[];
  explosions: Explosion[];
  items: Item[];
  config: BombermanConfig;
  rngState: number;
  eventCounter: number;
  events: BombermanEvent[];
  inputIndicators: Record<PlayerId, BombermanInputIndicator>;
  roundTimer?: number;
  shrinkBoundary?: number;
  bombIdCounter?: number;
  carriedBombs?: Record<PlayerId, Bomb>;
}

export type BombermanOperation =
  | { type: "MOVE"; direction: BombermanDirection; optimisticId?: number }
  | { type: "SET_DIRECTION"; direction: BombermanDirection | null; optimisticId?: number }
  | { type: "PLACE_BOMB"; optimisticId?: number }
  | { type: "ACTION"; optimisticId?: number }
  | { type: "DETONATE"; optimisticId?: number }
  | { type: "SURRENDER"; optimisticId?: number }
  | { type: "NOOP"; optimisticId?: number };

export interface BombermanRoomSpectator {
  id: PlayerId;
  name: string;
  joinedAt: number;
}

export type BombermanRoomPhase = "lobby" | "playing" | "between_rounds" | "disbanded";

export interface BombermanRoomPlayer {
  id: PlayerId;
  name: string;
  ready: boolean;
  isHost: boolean;
  teamId: TeamId;
  skinId?: string;
  color?: number;
  /** `"lobby"` by default; `"spectating"` when the player enters spectate mode during play. */
  status?: "lobby" | "spectating";
}

export interface BombermanRoomState {
  roomName: string;
  players: BombermanRoomPlayer[];
  config: BombermanConfig;
  phase: BombermanRoomPhase;
  maxPlayers: number;
  hostId: PlayerId;
  /** Current match state. Populated from round start; null when no match is active. */
  match: BombermanMatchState;
  /** Teams configured for this match. FFA creates one team per player. */
  teams: BombermanTeam[];
  /** Frozen map definitions for the current match. Populated at match start; each decisive round uses one. */
  frozenMaps?: BombermanMapDefinition[];
  spectators: BombermanRoomSpectator[];
}

export type BombermanPreGameClientAction =
  | { type: "READY"; optimisticId: number }
  | { type: "UNREADY"; optimisticId: number }
  | { type: "CHANGE_CONFIG"; optimisticId: number; payload: Partial<BombermanConfig> }
  | { type: "CHANGE_TEAM_MODE"; optimisticId: number; teamMode: PreGameTeamMode }
  | { type: "CHANGE_TEAM"; optimisticId: number; playerId: PlayerId; teamId: TeamId }
  | { type: "KICK_PLAYER"; optimisticId: number; targetId: PlayerId }
  | { type: "START_GAME"; optimisticId: number }
  | { type: "DISBAND_ROOM"; optimisticId: number }
  | { type: "CHANGE_APPEARANCE"; optimisticId: number; skinId: string }
  | { type: "ENTER_SPECTATE"; optimisticId: number }
  | { type: "LEAVE_SPECTATE"; optimisticId: number };
export type BombermanPreGameClientDispatch =
  | { type: "READY" }
  | { type: "UNREADY" }
  | { type: "CHANGE_CONFIG"; payload: Partial<BombermanConfig> }
  | { type: "CHANGE_TEAM_MODE"; teamMode: PreGameTeamMode }
  | { type: "CHANGE_TEAM"; playerId: PlayerId; teamId: TeamId }
  | { type: "KICK_PLAYER"; targetId: PlayerId }
  | { type: "START_GAME" }
  | { type: "DISBAND_ROOM" }
  | { type: "CHANGE_APPEARANCE"; skinId: string }
  | { type: "ENTER_SPECTATE" }
  | { type: "LEAVE_SPECTATE" };

export type BombermanStartRejectReason =
  | "NOT_HOST"
  | "PLAYERS_NOT_READY"
  | "INVALID_PLAYER_COUNT"
  | "INVALID_TEAMS"
  | "MAP_NOT_FOUND"
  | "MAP_INVALID";

export enum BombermanPreGameServerEventType {
  KICKED = "kicked",
  ROUND_STARTED = "roundstarted",
  ROUND_ENDED = "roundended",
  MATCH_ENDED = "matchended",
  START_REJECTED = "startrejected",
  ROOM_DISBANDED = "disbanded",
  DISPLACED = "displaced",
}

export type BombermanPreGameServerEvent =
  | { type: BombermanPreGameServerEventType.KICKED; reason?: string }
  | { type: BombermanPreGameServerEventType.ROUND_STARTED; startedAt: number; match: BombermanMatchState }
  | { type: BombermanPreGameServerEventType.ROUND_ENDED; result: BombermanRoundResult; match: BombermanMatchState }
  | {
      type: BombermanPreGameServerEventType.MATCH_ENDED;
      match: BombermanMatchState;
      rankings: BombermanMatchRanking[];
    }
  | {
      type: BombermanPreGameServerEventType.START_REJECTED;
      reason: BombermanStartRejectReason;
      mapIssues?: BombermanMapValidationIssue[];
    }
  | { type: BombermanPreGameServerEventType.ROOM_DISBANDED; reason?: string }
  | { type: BombermanPreGameServerEventType.DISPLACED; reason?: string };

export interface BombermanConnectResponse {
  playerId: PlayerId;
  phase: string;
  hasPassword?: boolean;
  role: "player" | "spectator";
  domains: {
    primary: string;
    game: string;
    chat: string;
  };
}

export interface BombermanGameEndResult {
  winnerId: PlayerId | null;
  reason: "last_alive" | "timeout" | "draw";
  state: BombermanState;
}

export const BOMBERMAN_REPLAY_ENGINE_VERSION = 1;

export interface BombermanReplayFrame {
  tick: number;
  operations: Array<{ playerId: PlayerId; operation: BombermanOperation }>;
}

export interface BombermanReplayRound {
  roundNumber: number;
  attempt: number;
  seed: number;
  initialState: BombermanState;
  frames: BombermanReplayFrame[];
  result: BombermanRoundResult;
}

export interface BombermanReplayParticipant {
  playerId: PlayerId;
  name: string;
  teamId: TeamId;
  skinId: string;
  isBot: boolean;
}

export interface BombermanReplayHeader {
  schemaVersion: 1;
  engineVersion: 1;
  matchId: string;
  config: BombermanConfig;
  participants: BombermanReplayParticipant[];
}

export interface BombermanReplay extends BombermanReplayHeader {
  rounds: BombermanReplayRound[];
  result: BombermanMatchState;
}

export interface BombermanReplaySummary {
  id: string;
  createdAt: number;
  expiresAt: number;
  format: BombermanMatchFormat;
  winner: BombermanWinner | null;
  roundCount: number;
}
