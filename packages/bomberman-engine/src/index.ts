// ─── Random ───
export { Mulberry32, createRandom } from "./random.js";
export type { BombermanRandom } from "./random.js";

// ─── Events (utility) ───
export { pushEvent, MAX_EVENTS } from "./events.js";

// ─── Game ───
export type { BombermanGameOptions, TickResult } from "./game.js";
export { createInitialBombermanState, tick } from "./game.js";

// ─── Map Generation ───
export type { BombermanMapGenerationOptions } from "./map-gen.js";
export { generateBombermanMap, getSpawnPositions, validateBombermanMapDefinition } from "./map-gen.js";

// ─── Replay ───
export type {
  BombermanReplayFrame,
  BombermanReplayRound,
  BombermanReplayParticipant,
  BombermanReplaySession,
} from "./replay.js";
export { createBombermanReplaySession } from "./replay.js";
