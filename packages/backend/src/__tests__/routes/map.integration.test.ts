import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createTestApp, loginAs, seedUser, type SeedUser, type TestAppContext } from "../helpers/integration";

type Tile = { type: string; army: number };
function makeTiles(width: number, height: number): Tile[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => ({ type: "0", army: 0 })));
}

const jsonHeaders = (sid: string): HeadersInit => ({ "Content-Type": "application/json", Cookie: `sid=${sid}` });

describe("Map Routes", () => {
  let context: TestAppContext;
  let user: SeedUser;
  let sid: string;

  beforeEach(async () => {
    context = await createTestApp();
    user = seedUser(context.rawDb);
    ({ sid } = await loginAs(context.app, user.username, user.password));
  });
  afterEach(async () => context.cleanup());

  it("GET /maps/list — returns list", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/maps/list"));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
  it("POST /maps/create — creates a map", async () => {
    const body = { name: "Test Map", width: 10, height: 10, gameType: "generale", data: makeTiles(10, 10) };
    const r = await context.app.handle(new Request("http://localhost/api/maps/create", { method: "POST", headers: jsonHeaders(sid), body: JSON.stringify(body) }));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBeTruthy();
  });
  it("POST /maps/create — returns unauthorized response without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/maps/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "X", width: 10, height: 10, gameType: "generale", data: makeTiles(10, 10) }) }));
    expect(r.status).toBe(401);
  });
  it("POST then GET /maps/detail/:id — preserves a Bomberman map", async () => {
    const tiles = makeTiles(15, 13);
    const body = { name: "Bomberman Map", width: 15, height: 13, gameType: "bomberman", data: tiles };
    const createResponse = await context.app.handle(new Request("http://localhost/api/maps/create", { method: "POST", headers: jsonHeaders(sid), body: JSON.stringify(body) }));
    expect(createResponse.status).toBe(200);
    const created = await createResponse.json();
    expect(created.success).toBe(true);
    const mapId = created.data.id as string;
    const detailResponse = await context.app.handle(new Request(`http://localhost/api/maps/detail/${mapId}`));
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json();
    expect(detail.success).toBe(true);
    expect(detail.data.id).toBe(mapId);
    expect(detail.data.gameType).toBe("bomberman");
    expect(detail.data.data).toEqual(tiles);
  });
  it("PATCH /maps/update/:id — updates map name", async () => {
    const createResponse = await context.app.handle(new Request("http://localhost/api/maps/create", { method: "POST", headers: jsonHeaders(sid), body: JSON.stringify({ name: "Update Test", width: 10, height: 10, gameType: "generale", data: makeTiles(10, 10) }) }));
    const { data } = await createResponse.json();
    const r = await context.app.handle(new Request(`http://localhost/api/maps/update/${data.id}`, { method: "PATCH", headers: jsonHeaders(sid), body: JSON.stringify({ name: "Updated Name" }) }));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.data.message).toBeTruthy();
    expect(json.data.id).toBe(data.id);
  });
  it("PATCH /maps/update/:id — returns unauthorized response without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/maps/update/some-id", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "X" }) }));
    expect(r.status).toBe(401);
  });
  it("DELETE /maps/delete/:id — returns unauthorized response without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/maps/delete/some-id", { method: "DELETE" }));
    expect(r.status).toBe(401);
  });
  it("DELETE /maps/delete/:id — deletes own map", async () => {
    const createResponse = await context.app.handle(new Request("http://localhost/api/maps/create", { method: "POST", headers: jsonHeaders(sid), body: JSON.stringify({ name: "Delete Me", width: 10, height: 10, gameType: "generale", data: makeTiles(10, 10) }) }));
    const { data } = await createResponse.json();
    const r = await context.app.handle(new Request(`http://localhost/api/maps/delete/${data.id}`, { method: "DELETE", headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    expect((await r.json()).success).toBe(true);
  });
  it("GET /maps/my — returns own maps", async () => {
    const createResponse = await context.app.handle(new Request("http://localhost/api/maps/create", { method: "POST", headers: jsonHeaders(sid), body: JSON.stringify({ name: "Mine", width: 10, height: 10, gameType: "generale", data: makeTiles(10, 10) }) }));
    expect(createResponse.status).toBe(200);
    const r = await context.app.handle(new Request("http://localhost/api/maps/my", { headers: { Cookie: `sid=${sid}` } }));
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(json.success).toBe(true);
    expect(json.data.some((map: { name: string }) => map.name === "Mine")).toBe(true);
  });
  it("GET /maps/my — returns unauthorized response without auth", async () => {
    const r = await context.app.handle(new Request("http://localhost/api/maps/my"));
    expect(r.status).toBe(401);
  });
});
