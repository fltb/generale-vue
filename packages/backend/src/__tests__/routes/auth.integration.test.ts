import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createTestApp, loginAs, seedUser, type SeedUser, type TestAppContext } from "../helpers/integration";

describe("Auth Routes", () => {
  let context: TestAppContext;
  let user: SeedUser;

  beforeEach(async () => {
    context = await createTestApp();
    user = seedUser(context.rawDb);
  });
  afterEach(async () => context.cleanup());

  it("POST /register — creates user", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "newuser", email: "n@t.com", password: "secret123", confirmPassword: "secret123" }) }));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
  it("POST /register — rejects duplicate username", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user.username, email: "d@t.com", password: "secret123", confirmPassword: "secret123" }) }));
    expect(r.status).toBe(409);
  });
  it("POST /register — rejects short password", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "shortpw", email: "s@t.com", password: "12", confirmPassword: "12" }) }));
    expect(r.status).toBe(422);
  });
  it("POST /login — returns sid cookie", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    expect(sid).toBeTruthy();
  });
  it("POST /login — rejects wrong password", async () => {
    const { status } = await loginAs(context.app, user.username, "wrongpw");
    expect(status).toBe(401);
  });
  it("GET /me — returns current user", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    const r = await context.app.handle(new Request("http://localhost/api/me", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    expect((await r.json()).user.username).toBe(user.username);
  });
  it("GET /me — returns unauthorized response without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/me"));
    expect(r.status).toBe(401);
  });
  it("POST /logout — clears session", async () => {
    const { sid } = await loginAs(context.app, user.username, user.password);
    await context.app.handle(new Request("http://localhost/api/logout", { method: "POST", headers: { Cookie: `sid=${sid}` } }));
    const r = await context.app.handle(new Request("http://localhost/api/me", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(401);
  });
});
