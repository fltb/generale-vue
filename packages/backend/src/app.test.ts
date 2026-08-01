import { describe, expect, it, vi } from "vitest";

vi.mock("./db/migrate", () => ({
  runMigrations: vi.fn(),
}));

// Polyfill Bun global for Node/Vitest — ensureDefaultAvatars uses Bun.file()
// and Elysia reads Bun.env.ELYSIA_AOT at construct time.
// Direct globalThis assignment (not vi.stubGlobal) so it survives
// vitest.setup.ts's vi.unstubAllGlobals() in afterEach.
Object.defineProperty(globalThis, "Bun", {
  value: {
    file: () => ({ exists: async () => true }),
    env: { ELYSIA_AOT: "false" },
    Glob: class {
      constructor(_pattern: string) {}
      scan(_dir: string): AsyncIterable<string> {
        return {
          [Symbol.asyncIterator]: () => ({
            next: async () => ({ done: true, value: undefined as never }),
          }),
        };
      }
    },
  },
  writable: false,
  configurable: true,
});

const { createApp } = await import("./app");

describe("global error handler", () => {
  it("returns opaque 500 for unexpected error codes", async () => {
    const app = await createApp({
      skipMigrations: true,
      skipEmailInit: true,
      skipSessionPrune: true,
    });

    // Route that throws with an unexpected (non-framework) error code
    app.get("/__test__/custom-error", () => {
      const err = new Error("custom internal failure");
      (err as Record<string, unknown>).code = "DB_CONNECTION_FAILED";
      throw err;
    });

    const res = await app.fetch(new Request("http://localhost/__test__/custom-error"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ success: false, error: "Internal server error" });
  });

  it("leaves NOT_FOUND (framework error) intact", async () => {
    const app = await createApp({
      skipMigrations: true,
      skipEmailInit: true,
      skipSessionPrune: true,
    });

    const res = await app.fetch(new Request("http://localhost/__test__/nonexistent"));
    expect(res.status).toBe(404);
  });
});
