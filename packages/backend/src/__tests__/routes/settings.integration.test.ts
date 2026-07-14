import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createTestApp, seedUser, loginAs } from "../helpers/integration";
import type { SeedUser } from "../helpers/integration";
import type { Database } from "bun:sqlite";
import type { Elysia } from "elysia";
import { GLOBAL_SETTINGS_DEFAULTS } from "@generale/types";

describe("Settings Routes", () => {
  let app: Elysia;
  let rawDb: Database;
  let user: SeedUser;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app; rawDb = ctx.rawDb;
    user = seedUser(rawDb);
  });
  afterAll(() => rawDb.close());

  // ── Global ──

  it("GET /api/settings/global — returns defaults for new user", async () => {
    const { sid } = await loginAs(app, user.username, "testpass123");
    const r = await app.handle(new Request("http://localhost/api/settings/global", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(GLOBAL_SETTINGS_DEFAULTS);
  });

  it("GET /api/settings/global — 401 without auth", async () => {
    const r = await app.handle(new Request("http://localhost/api/settings/global"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Not authorized");
  });

  it("PATCH /api/settings/global — sets a setting", async () => {
    const { sid } = await loginAs(app, user.username, "testpass123");
    const r = await app.handle(new Request("http://localhost/api/settings/global", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` },
      body: JSON.stringify({ locale: "zh-CN" }),
    }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
  });

  it("GET /api/settings/global — returns saved setting (deserialized)", async () => {
    const { sid } = await loginAs(app, user.username, "testpass123");
    const r = await app.handle(new Request("http://localhost/api/settings/global", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.locale).toBe("zh-CN");
    expect(body.data.theme).toBe("system");
    expect(body.data.soundMuted).toBe(false);
  });

  it("PATCH /api/settings/global — overwrites existing setting", async () => {
    const { sid } = await loginAs(app, user.username, "testpass123");
    await app.handle(new Request("http://localhost/api/settings/global", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` },
      body: JSON.stringify({ locale: "en" }),
    }));
    const r = await app.handle(new Request("http://localhost/api/settings/global", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.locale).toBe("en");
  });

  it("PATCH /api/settings/global — 401 without auth", async () => {
    const r = await app.handle(new Request("http://localhost/api/settings/global", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "en" }),
    }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Not authorized");
  });

  // ── Game ──

  it("GET /api/settings/game/bomberman — returns defaults", async () => {
    const { sid } = await loginAs(app, user.username, "testpass123");
    const r = await app.handle(new Request("http://localhost/api/settings/game/bomberman", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.data.soundVolume).toBe(1);
    expect(body.data.keybindings).toBeDefined();
  });

  it("GET /api/settings/game/bomberman — 401 without auth", async () => {
    const r = await app.handle(new Request("http://localhost/api/settings/game/bomberman"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(false);
  });

  it("PATCH /api/settings/game/bomberman — sets a setting", async () => {
    const { sid } = await loginAs(app, user.username, "testpass123");
    const r = await app.handle(new Request("http://localhost/api/settings/game/bomberman", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` },
      body: JSON.stringify({ soundVolume: "0.5" }),
    }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
  });

  // ── All ──

  it("GET /api/settings/all — batch fetches global + game settings", async () => {
    const { sid } = await loginAs(app, user.username, "testpass123");
    const r = await app.handle(new Request("http://localhost/api/settings/all", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.data.global).toBeDefined();
    expect(body.data.global.locale).toBe("en");
    expect(body.data.games).toBeDefined();
    // bomberman should be present since we set a value earlier
    expect(body.data.games.bomberman).toBeDefined();
    expect(body.data.games.bomberman.soundVolume).toBe(0.5);
  });
});
