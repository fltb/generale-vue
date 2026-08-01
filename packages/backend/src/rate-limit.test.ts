import { describe, expect, it } from "vitest";
import { Elysia } from "elysia";
import { rateLimit } from "elysia-rate-limit";

const authPaths = [
  "/api/register",
  "/api/login",
  "/api/forgot-password",
  "/api/reset-password",
] as const;

/** Deterministic mock Bun server that provides a stable requestIP. */
function mockServer(address = "127.0.0.1") {
  return {
    requestIP: () => ({
      address,
      family: "IPv4" as const,
      port: 0,
    }),
  };
}

describe("auth rate limiter", () => {
  it("returns 429 on the 6th auth request while non-auth routes are unrestricted", async () => {
    const app = new Elysia().use(
      rateLimit({
        max: 5,
        duration: 60_000,
        injectServer: mockServer,
        skip: (req, key) => {
          // No key → serverless test environment → skip accounting
          if (!key) return true;
          const url = new URL(req.url);
          const path = url.pathname;
          // Only apply to the four auth paths
          return !authPaths.includes(path as typeof authPaths[number]);
        },
      }),
    );

    // Stub handlers so real auth logic is never invoked
    for (const path of authPaths) {
    app.get(path, () => new Response("ok", { status: 200 }));
    }
    app.get("/api/health", () => new Response("ok", { status: 200 }));

    const base = "http://localhost";

    // 5 auth requests across the protected paths — all must succeed
    for (let i = 0; i < 5; i++) {
      // Rotate through the paths so we use all of them
      const path = authPaths[i % authPaths.length];
      const res = await app.fetch(new Request(`${base}${path}`));
      expect(res.status, `request ${i + 1} to ${path}`).toBe(200);
    }

    // 6th request to any auth path — rate-limited to 429
    const limited = await app.fetch(new Request(`${base}/api/register`));
    expect(limited.status).toBe(429);
    const body = await limited.text();
    expect(body).toBe("rate-limit reached");

    // Non-auth path is not counted by this limiter
    const health = await app.fetch(new Request(`${base}/api/health`));
    expect(health.status).toBe(200);
  });
});
