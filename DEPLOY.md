# Generale — Production Deployment Checklist

## 1. Configure environment

Create `.env` in the deployment directory (`deploy/generale-server/`) with the following variables:

| Variable | Required | Purpose |
|---|---|---|
| `DB_FILE_NAME` | yes | Path to SQLite database file (e.g. `/var/lib/generale/data.sqlite`) |
| `PUBLIC_URL` | yes | Public HTTPS URL of the deployed site (e.g. `https://generale.example.com`) |
| `EMAIL_METHOD` | yes | `none` to skip email; or `smtp` and provide the `SMTP_*` variables below |
| `SMTP_HOST` | if `EMAIL_METHOD=smtp` | SMTP server hostname |
| `SMTP_PORT` | if `EMAIL_METHOD=smtp` | SMTP server port (commonly 465 or 587) |
| `SMTP_SECURE` | if `EMAIL_METHOD=smtp` | `true` for TLS (`true`/`false`) |
| `SMTP_USER` | if `EMAIL_METHOD=smtp` | SMTP username |
| `SMTP_PASS` | if `EMAIL_METHOD=smtp` | SMTP password |

The startup script sources `.env` automatically. For a quick start without email, set `EMAIL_METHOD=none`.

## 2. Transfer the artifact

Copy the entire `deploy/generale-server/` directory to the production host. The artifact layout is:

```
generale-server/
  server                    # Self-contained backend binary
  start.sh                  # Production startup script
  .env                      # (you create this — see step 1)
  frontend/                 # Pre-built static frontend (index.html, JS/CSS bundles)
  migrations/               # SQLite schema migrations (applied on startup)
  public/                   # Default avatars and built-in maps
```

The runtime command is `./server`, a self-contained binary produced by `bun build --compile`. Bun is not required on the production host.

## 3. Launch

```bash
cd /path/to/generale-server
chmod +x start.sh
./start.sh
```

`start.sh` loads `.env`, creates the database directory and migrations folder, then executes `./server`. The server listens on `HOST:PORT` (defaults: `0.0.0.0:3000`).

## 4. Verify

```bash
curl http://localhost:3000/api/health
# Expect: {"status":"ok","timestamp":"2026-07-27T12:00:00.000Z"}
```

## 5. Put HTTPS behind a reverse proxy

Configure nginx or Caddy to terminate TLS and proxy to `127.0.0.1:3000`. Set `PUBLIC_URL` in `.env` to the public HTTPS URL (e.g. `https://generale.example.com`) so sitemaps, robots, and Open Graph metadata use the correct origin.

**nginx example:**

```nginx
server {
    listen 443 ssl;
    server_name generale.example.com;

    ssl_certificate     /etc/ssl/certs/example.crt;
    ssl_certificate_key /etc/ssl/private/example.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Caddy example:**

```
generale.example.com {
    reverse_proxy 127.0.0.1:3000
}
```
