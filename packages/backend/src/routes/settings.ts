import { type Elysia, t } from "elysia";
import { db } from "../db/client";
import { userSettings, gameUserSettings } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { sessionService } from "../services/sessionService";
import {
  GLOBAL_SETTINGS_KEYS,
  GLOBAL_SETTINGS_DEFAULTS,
  deserializeGlobalSetting,
  type GlobalSettings,
} from "@generale/types";
import { getGameSettingsSchema } from "../services/gameSettingsRegistry";

function getUserId(cookie: { sid?: { value?: string } }): string | null {
  const sid = cookie?.sid?.value;
  if (!sid) return null;
  const session = sessionService.get(sid);
  return session?.userId ?? null;
}

export function settingsRoutes(app: Elysia) {
  return app
    // ─── Global settings ───
    .get("/global", async ({ cookie }) => {
      const userId = getUserId(cookie);
      if (!userId) return { success: false, message: "Not authorized" };
      const rows = await db
        .select({ key: userSettings.key, value: userSettings.value })
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      const result: Record<string, unknown> = { ...GLOBAL_SETTINGS_DEFAULTS };
      for (const r of rows) {
        if (!(GLOBAL_SETTINGS_KEYS as readonly string[]).includes(r.key)) continue;
        const key = r.key as keyof GlobalSettings;
        const parsed = deserializeGlobalSetting(key, r.value);
        if (parsed !== undefined) result[key] = parsed;
      }
      return { success: true, data: result };
    })
    .patch(
      "/global",
      async ({ cookie, body }) => {
        const userId = getUserId(cookie);
        if (!userId) return { success: false, message: "Not authorized" };
        const now = new Date();
        for (const [key, value] of Object.entries(body as Record<string, string>)) {
          if (!(GLOBAL_SETTINGS_KEYS as readonly string[]).includes(key)) continue;
          // The client sends already-serialized strings, so store directly
          await db
            .insert(userSettings)
            .values({ userId, key, value: String(value), updatedAt: now })
            .onConflictDoUpdate({
              target: [userSettings.userId, userSettings.key],
              set: { value: String(value), updatedAt: now },
            });
        }
        return { success: true };
      },
      { body: t.Record(t.String(), t.String()) },
    )
    // ─── Game settings ───
    .get("/game/:gameType", async ({ cookie, params }) => {
      const userId = getUserId(cookie);
      if (!userId) return { success: false, message: "Not authorized" };
      const schema = getGameSettingsSchema(params.gameType);
      if (!schema) return { success: false, message: "Unknown game type" };
      const rows = await db
        .select({ key: gameUserSettings.key, value: gameUserSettings.value })
        .from(gameUserSettings)
        .where(and(eq(gameUserSettings.userId, userId), eq(gameUserSettings.gameType, params.gameType)));
      const result = { ...schema.defaults };
      for (const r of rows) {
        if (!schema.keys.includes(r.key)) continue;
        const parsed = schema.deserialize(r.key as keyof typeof result & string, r.value);
        if (parsed !== undefined) {
          (result as Record<string, unknown>)[r.key] = parsed;
        }
      }
      return { success: true, data: result };
    })
    .patch(
      "/game/:gameType",
      async ({ cookie, params, body }) => {
        const userId = getUserId(cookie);
        if (!userId) return { success: false, message: "Not authorized" };
        const schema = getGameSettingsSchema(params.gameType);
        if (!schema) return { success: false, message: "Unknown game type" };
        const now = Date.now();
        for (const [key, value] of Object.entries(body as Record<string, string>)) {
          if (!schema.keys.includes(key)) continue;
          await db
            .insert(gameUserSettings)
            .values({ userId, gameType: params.gameType, key, value: String(value), updatedAt: now })
            .onConflictDoUpdate({
              target: [gameUserSettings.userId, gameUserSettings.gameType, gameUserSettings.key],
              set: { value: String(value), updatedAt: now },
            });
        }
        return { success: true };
      },
      { body: t.Record(t.String(), t.String()) },
    )
    // ─── Batch: all settings in one call ───
    .get("/all", async ({ cookie }) => {
      const userId = getUserId(cookie);
      if (!userId) return { success: false, message: "Not authorized" };

      // Global settings
      const globalRows = await db
        .select({ key: userSettings.key, value: userSettings.value })
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      const global = { ...GLOBAL_SETTINGS_DEFAULTS } as Record<string, unknown>;
      for (const r of globalRows) {
        if (!(GLOBAL_SETTINGS_KEYS as readonly string[]).includes(r.key)) continue;
        const parsed = deserializeGlobalSetting(r.key as keyof GlobalSettings, r.value);
        if (parsed !== undefined) global[r.key] = parsed;
      }

      // Game settings — fetch all game types for this user
      const gameRows = await db
        .select()
        .from(gameUserSettings)
        .where(eq(gameUserSettings.userId, userId));
      const games: Record<string, Record<string, unknown>> = {};
      for (const r of gameRows) {
        const schema = getGameSettingsSchema(r.gameType);
        if (!schema) continue;
        if (!games[r.gameType]) games[r.gameType] = { ...schema.defaults };
        if (!schema.keys.includes(r.key)) continue;
        const parsed = schema.deserialize(r.key, r.value);
        if (parsed !== undefined) {
          const target = games[r.gameType];
          if (target) target[r.key] = parsed;
        }
      }

      return { success: true, data: { global, games } };
    });
}
