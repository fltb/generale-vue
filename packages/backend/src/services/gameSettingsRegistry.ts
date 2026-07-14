import type { GameSettingsSchema } from "@generale/types";
import { bombermanSettingsSchema } from "@generale/types";

const registry = new Map<string, GameSettingsSchema<Record<string, unknown>>>();

export function registerGameSettings<T extends Record<string, unknown>>(
  schema: GameSettingsSchema<T>,
): void {
  registry.set(schema.gameType, schema as unknown as GameSettingsSchema<Record<string, unknown>>);
}

export function getGameSettingsSchema(
  gameType: string,
): GameSettingsSchema<Record<string, unknown>> | undefined {
  return registry.get(gameType);
}

// Register known games at module load
registerGameSettings(bombermanSettingsSchema as unknown as GameSettingsSchema<Record<string, unknown>>);
