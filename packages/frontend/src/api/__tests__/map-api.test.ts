import { describe, it, expect, vi, beforeEach } from "vitest";
import { listMapsApi, myMapsApi, mapDetailApi, createMapApi, updateMapApi, deleteMapApi, forkMapApi, discardDraftApi } from "../mapApi";
import { jsonResponse } from "../../__tests__/helpers/jsonResponse";

beforeEach(() => vi.restoreAllMocks());

describe("listMapsApi", () => {
  it("GET /api/maps/list", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] })));
    const res = await listMapsApi();
    expect(Array.isArray(res.data)).toBe(true);
  });
});

describe("myMapsApi", () => {
  it("GET /api/maps/my", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: [] })));
    const res = await myMapsApi();
    expect(Array.isArray(res.data)).toBe(true);
  });
});

describe("mapDetailApi", () => {
  it("GET /api/maps/detail/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { id: "m1", name: "My Map" } })));
    const res = await mapDetailApi("m1");
    expect(res.data.id).toBe("m1");
  });

  it("passes draft=0 when draft=false", async () => {
    const fn = vi.fn().mockResolvedValue(jsonResponse({ data: { id: "m1" } }));
    vi.stubGlobal("fetch", fn);
    await mapDetailApi("m1", false);
    expect(fn.mock.calls[0][0]).toContain("draft=0");
  });
});

describe("createMapApi", () => {
  it("POST /api/maps/create", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { message: "ok", id: "m1" } })));
    const res = await createMapApi({ name: "New Map", data: {} });
    expect(res.data.id).toBe("m1");
  });
});

describe("updateMapApi", () => {
  it("PATCH /api/maps/update/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { message: "ok", id: "m1" } })));
    const res = await updateMapApi("m1", { name: "Updated" });
    expect(res.data.id).toBe("m1");
  });
});

describe("deleteMapApi", () => {
  it("DELETE /api/maps/delete/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true })));
    const res = await deleteMapApi("m1");
    expect(res.success).toBe(true);
  });
});

describe("forkMapApi", () => {
  it("POST /api/maps/fork/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { message: "ok", id: "m1" } })));
    const res = await forkMapApi("m1");
    expect(res.data.id).toBe("m1");
  });
});

describe("discardDraftApi", () => {
  it("POST /api/maps/discard-draft/:id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true })));
    const res = await discardDraftApi("m1");
    expect(res.success).toBe(true);
  });
});
