import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createTestApp, loginAs, seedUser, type SeedUser, type TestAppContext } from "../helpers/integration";

describe("Game + Profile Routes", () => {
  let context: TestAppContext;
  let user: SeedUser;
  let sid: string;

  beforeEach(async () => {
    context = await createTestApp();
    user = seedUser(context.rawDb);
    ({ sid } = await loginAs(context.app, user.username, user.password));
  });
  afterEach(async () => context.cleanup());

  it("GET /profile/:id — returns profile", async () => {
    const r = await context.app.handle(new Request(`http://localhost/api/profile/${user.userId}`));
    expect(r.status).toBe(200);
    expect((await r.json()).username).toBe(user.username);
  });
  it("GET /profile/:id — 404 for unknown", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/profile/nonexistent"));
    expect(r.status).toBe(404);
  });
  it("PATCH /me — updates displayName", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/profile/me", { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ displayName: "NewName" }) }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
  });
  it("PATCH /me — returns unauthorized response without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/profile/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: "X" }) }));
    expect(r.status).toBe(401);
  });
  it("POST /game/create — creates game", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/game/create", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `sid=${sid}` }, body: JSON.stringify({ roomName: "Test", gameSettings: { type: "standard", maxPlayers: 4, mapSize: "small", teamMode: "ffa" } }) }));
    expect(r.status).toBe(200);
    expect((await r.json()).data.gameId).toBeTruthy();
  });
  it("POST /game/create — returns unauthorized response without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/game/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomName: "X", gameSettings: { type: "standard", maxPlayers: 2, mapSize: "small", teamMode: "ffa" } }) }));
    expect(r.status).toBe(401);
  });
  it("GET /game/list — returns list", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/game/list"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
  it("GET /game/info/:id — 404 for unknown", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/game/info/nonexistent"));
    expect(r.status).toBe(404);
  });
  it("GET /health — returns ok", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/health"));
    expect((await r.json()).status).toBe("ok");
  });
});
