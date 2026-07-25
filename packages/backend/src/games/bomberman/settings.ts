import { VALID_BOMBERMAN_THEME_IDS, BOMBERMAN_PRESET_DEFINITIONS } from "@generale/types";
import type { BombermanConfig, ItemType } from "@generale/types";

const ALL_ITEMS: ItemType[] = [
  "BOMB_UP",
  "FIRE_UP",
  "SPEED_UP",
  "KICK",
  "GLOVE",
  "PUNCH",
  "REMOTE",
  "PIERCE",
  "SPIRIT",
];

export function defaultBombermanConfig(): BombermanConfig {
  return {
    mapWidth: 15,
    mapHeight: 13,
    playerLimit: 4,
    tickRate: 10,
    bombFuse: 20,
    bombLimit: 2,
    blastRadius: 2,
    roundTimeSec: 120,
    shrinkEnabled: true,
    itemDropRate: 0.6,
    items: [...ALL_ITEMS],
    matchFormat: "single",
    teamMode: "ffa",
    botCount: 0,
    botDifficulty: "easy",
    mapSource: { type: "procedural", themeId: "classic" },
  };
}

export function validateBombermanConfig(config: unknown): string | null {
  if (typeof config !== "object" || config === null) return "config must be an object";
  const c = config as Partial<BombermanConfig>;
  if (c.mapWidth !== undefined && (!Number.isInteger(c.mapWidth) || c.mapWidth < 11 || c.mapWidth > 31)) {
    return "mapWidth must be an integer between 11 and 31";
  }
  if (c.mapHeight !== undefined && (!Number.isInteger(c.mapHeight) || c.mapHeight < 11 || c.mapHeight > 31)) {
    return "mapHeight must be an integer between 11 and 31";
  }
  if (c.playerLimit !== undefined && (!Number.isInteger(c.playerLimit) || c.playerLimit < 2 || c.playerLimit > 4)) {
    return "playerLimit must be an integer between 2 and 4";
  }
  if (c.tickRate !== undefined && (!Number.isInteger(c.tickRate) || c.tickRate < 8 || c.tickRate > 20)) {
    return "tickRate must be an integer between 8 and 20";
  }
  if (c.botCount !== undefined && (!Number.isInteger(c.botCount) || c.botCount < 0 || c.botCount > 3)) {
    return "botCount must be an integer between 0 and 3";
  }
  if (c.botCount !== undefined && c.playerLimit !== undefined && c.botCount >= c.playerLimit) {
    return "botCount must be less than playerLimit";
  }
  if (c.matchFormat !== undefined && !["single", "bo3", "bo5"].includes(c.matchFormat)) {
    return "matchFormat must be single, bo3, or bo5";
  }
  if (c.teamMode !== undefined && c.teamMode !== "ffa" && c.teamMode !== "team") {
    return "teamMode must be ffa or team";
  }
  if (c.botDifficulty !== undefined && !["easy", "normal", "hard"].includes(c.botDifficulty)) {
    return "botDifficulty must be easy, normal, or hard";
  }
  if (c.mapSource !== undefined) {
    if (c.mapSource.type === "rotation") {
      if (c.mapSource.maps.length === 0) return "mapSource rotation must contain at least one map";
      const keys = c.mapSource.maps.map((map) => `${map.type}:${map.id}`);
      if (new Set(keys).size !== keys.length) return "mapSource rotation maps must be unique";
    } else if (c.mapSource.type === "procedural") {
      if (c.mapSource.themeId !== undefined && !VALID_BOMBERMAN_THEME_IDS[c.mapSource.themeId]) {
        return `procedural themeId "${c.mapSource.themeId}" is not valid`;
      }
    } else if (c.mapSource.type === "preset") {
      if (c.mapSource.id !== undefined && !BOMBERMAN_PRESET_DEFINITIONS[c.mapSource.id]) {
        return `preset id "${c.mapSource.id}" is not valid`;
      }
    } else if (c.mapSource.type !== "workshop") {
      return "mapSource is invalid";
    }
  }
  return null;
}
