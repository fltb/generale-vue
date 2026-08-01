import { Elysia } from "elysia";

const GAME_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
].join("; ");

const HSTS = "max-age=31536000; includeSubDomains";

/**
 * Security-headers plugin.
 *
 * Sets strict response headers on every request: CSP, HSTS, frame
 * protection, MIME-sniffing prevention, and referrer policy.
 */
export const securityHeaders = new Elysia({ name: "security-headers" }).onRequest(({ set }) => {
  set.headers["X-Frame-Options"] = "DENY";
  set.headers["X-Content-Type-Options"] = "nosniff";
  set.headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
  set.headers["Strict-Transport-Security"] = HSTS;
  set.headers["Content-Security-Policy"] = GAME_CSP;
});
