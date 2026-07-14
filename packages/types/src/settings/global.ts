export interface GlobalSettings {
  locale: "en" | "zh-CN";
  theme: "light" | "dark" | "system";
  soundMuted: boolean;
}

export const GLOBAL_SETTINGS_KEYS: readonly (keyof GlobalSettings)[] = [
  "locale",
  "theme",
  "soundMuted",
] as const;

export const GLOBAL_SETTINGS_DEFAULTS: GlobalSettings = {
  locale: "en",
  theme: "system",
  soundMuted: false,
};

/** DB stores everything as text. This maps typed value to string. */
export function serializeGlobalSetting<K extends keyof GlobalSettings>(
  key: K,
  value: GlobalSettings[K],
): string {
  if (key === "soundMuted") return value ? "1" : "0";
  return String(value);
}

/** string to typed value. Returns undefined if parse fails. */
export function deserializeGlobalSetting<K extends keyof GlobalSettings>(
  key: K,
  raw: string,
): GlobalSettings[K] | undefined {
  if (key === "soundMuted") return (raw === "1") as GlobalSettings[K];
  if (key === "locale") {
    if (raw === "en" || raw === "zh-CN") return raw as GlobalSettings[K];
    return undefined;
  }
  if (key === "theme") {
    if (raw === "light" || raw === "dark" || raw === "system") return raw as GlobalSettings[K];
    return undefined;
  }
  return raw as GlobalSettings[K];
}
