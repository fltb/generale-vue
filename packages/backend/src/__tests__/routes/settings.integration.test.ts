import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { GLOBAL_SETTINGS_DEFAULTS } from "@generale/types";
import { createTestApp, loginAs, seedUser, type SeedUser, type TestAppContext } from "../helpers/integration";

describe("Settings Routes", () => {
  let context: TestAppContext;
  let user: SeedUser;

  beforeEach(async () => {
    context = await createTestApp();
    user = seedUser(context.rawDb);
  });
  afterEach(async () => context.cleanup());

  it("GET /api/settings/global — returns defaults for new user", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    const r = await context.app.handle(new Request("http://localhost/api/settings/global", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual(GLOBAL_SETTINGS_DEFAULTS);
  });
  it("GET /api/settings/global — returns not-authorized body without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/settings/global"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Not authorized");
  });
  it("PATCH /api/settings/global — sets a setting", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    const r = await context.app.handle(new Request("http://localhost/api/settings/global", { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ locale: "zh-CN" }) }));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
  it("GET /api/settings/global — returns saved setting (deserialized)", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    await context.app.handle(new Request("http://localhost/api/settings/global", { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ locale: "zh-CN" }) }));
    const r = await context.app.handle(new Request("http://localhost/api/settings/global", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.data.locale).toBe("zh-CN");
    expect(body.data.theme).toBe("system");
    expect(body.data.soundMuted).toBe(false);
  });
  it("PATCH /api/settings/global — overwrites existing setting", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    await context.app.handle(new Request("http://localhost/api/settings/global", { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ locale: "zh-CN" }) }));
    const r = await context.app.handle(new Request("http://localhost/api/settings/global", { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ locale: "en" }) }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    const current = await context.app.handle(new Request("http://localhost/api/settings/global", { headers: { Cookie: `sid=${sid}` } }));
    expect((await current.json()).data.locale).toBe("en");
  });
  it("PATCH /api/settings/global — returns not-authorized body without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/settings/global", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: "en" }) }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Not authorized");
  });
  it("GET /api/settings/game/bomberman — returns defaults", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    const r = await context.app.handle(new Request("http://localhost/api/settings/game/bomberman", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.data.soundVolume).toBe(1);
    expect(body.data.keybindings).toBeDefined();
  });
  it("GET /api/settings/game/bomberman — returns not-authorized body without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/settings/game/bomberman"));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(false);
  });
  it("PATCH /api/settings/game/bomberman — sets a setting", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    const r = await context.app.handle(new Request("http://localhost/api/settings/game/bomberman", { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ soundVolume: "0.5" }) }));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
  it("GET /api/settings/all — batch fetches global + game settings", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    await context.app.handle(new Request("http://localhost/api/settings/global", { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ locale: "en" }) }));
    await context.app.handle(new Request("http://localhost/api/settings/game/bomberman", { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ soundVolume: "0.5" }) }));
    const r = await context.app.handle(new Request("http://localhost/api/settings/all", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.data.global.locale).toBe("en");
    expect(body.data.games.bomberman.soundVolume).toBe(0.5);
  });
});
