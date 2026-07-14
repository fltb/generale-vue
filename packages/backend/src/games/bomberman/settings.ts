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
  };
}

export function validateBombermanConfig(config: unknown): string | null {
  const c = config as Partial<BombermanConfig>;
  if (c.mapWidth !== undefined && (c.mapWidth < 11 || c.mapWidth > 31)) {
    return "mapWidth must be between 11 and 31";
  }
  if (c.mapHeight !== undefined && (c.mapHeight < 11 || c.mapHeight > 31)) {
    return "mapHeight must be between 11 and 31";
  }
  if (c.playerLimit !== undefined && (c.playerLimit < 2 || c.playerLimit > 4)) {
    return "playerLimit must be between 2 and 4";
  }
  if (c.tickRate !== undefined && (c.tickRate < 8 || c.tickRate > 20)) {
    return "tickRate must be between 8 and 20";
  }
  return null;
}
