/**
 * A game declares its settings schema. The schema carries:
 *  - typed keys (compile-time)
 *  - defaults (runtime, for merging with partial DB responses)
 *  - serialize/deserialize per key (for DB text storage)
 */
export interface GameSettingsSchema<T extends object> {
  /** Unique game type string, e.g. "bomberman" */
  gameType: string;
  /** Default values for every key */
  defaults: T;
  /** Valid keys whitelist — server rejects unknown keys on PATCH */
  keys: readonly (keyof T & string)[];
  /** Serialize a typed value to a DB-storable string */
  serialize<K extends keyof T & string>(key: K, value: T[K]): string;
  /** Deserialize a DB string to a typed value. Return undefined on parse failure. */
  deserialize<K extends keyof T & string>(key: K, raw: string): T[K] | undefined;
}

/** Helper: build a schema that uses JSON.stringify/parse for all values */
export function jsonGameSettingsSchema<T extends object>(
  gameType: string,
  defaults: T,
  keys: readonly (keyof T & string)[],
): GameSettingsSchema<T> {
  return {
    gameType,
    defaults,
    keys,
    serialize: (_key, value) => JSON.stringify(value),
    deserialize: (_key, raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
  };
}
