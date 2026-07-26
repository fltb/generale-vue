import { describe, expect, it } from "bun:test";
import { createTestApp, loginAs, seedUser } from "./integration";

describe("integration test helpers", () => {
  it("creates a migrated app, seeds a user, and logs in", async () => {
    const context = await createTestApp();
    try {
      const user = seedUser(context.rawDb);
      const { sid, status } = await loginAs(context.app, user.username, user.password);
      expect(status).toBe(200);
      expect(sid).toBeTruthy();
      const migrationTables = context.rawDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'profiles', 'sessions', 'custom_maps') ORDER BY name")
        .all() as Array<{ name: string }>;
      expect(migrationTables.map(({ name }) => name)).toEqual(["custom_maps", "profiles", "sessions", "users"]);
    } finally {
      await context.cleanup();
    }
  });
});
