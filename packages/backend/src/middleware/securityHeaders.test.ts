import { describe, expect, it } from "vitest";
import { Elysia } from "elysia";

import { securityHeaders } from "./securityHeaders";

describe("securityHeaders plugin", () => {
  it("sets all security headers on every response", async () => {
    const app = new Elysia()
      .use(securityHeaders)
      // Dummy route to exercise the plugin
      .get("/test", () => "ok");

    const res = await app.fetch(new Request("http://localhost/test"));

    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(res.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'",
    );
  });
});
