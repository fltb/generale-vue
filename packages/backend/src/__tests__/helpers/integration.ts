import { Database } from "bun:sqlite";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { authPlugin } from "../../middleware/authPlugin";
import { userRoutes } from "../../routes/user";
import { profileRoutes } from "../../routes/profile";
import { gameRoutes } from "../../games/generale/routes";
import { db, resetDb } from "../../db/client";
import { mapRoutes } from "../../routes/map";
import { settingsRoutes } from "../../routes/settings";
import { pbkdf2Sync, randomBytes } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 1000, 32, "sha256").toString("hex");
  return `${salt}$${hash}`;
}

export interface SeedUser {
  userId: string;
  username: string;
  password: string;
}

interface DrizzleSession {
  client: Database;
}

interface DrizzleDatabase {
  session?: DrizzleSession;
}

export interface TestAppContext {
  app: Elysia;
  rawDb: Database;
  cleanup: () => Promise<void>;
}

let seedSequence = 0;

export async function createTestApp(): Promise<TestAppContext> {
  const previousDbFile = process.env["DB_FILE_NAME"];
  const previousMigrationsFolder = process.env["MIGRATIONS_FOLDER"];
  const tempDir = await mkdtemp(path.join("/tmp", "generale-backend-test-"));
  const dbFile = path.join(tempDir, "test.sqlite");
  const migrationsFolder = path.resolve(import.meta.dir, "../../../drizzle");
  let rawDb: Database | undefined;
  let cleaned = false;

  const restoreEnv = (): void => {
    if (previousDbFile === undefined) delete process.env["DB_FILE_NAME"];
    else process.env["DB_FILE_NAME"] = previousDbFile;
    if (previousMigrationsFolder === undefined) delete process.env["MIGRATIONS_FOLDER"];
    else process.env["MIGRATIONS_FOLDER"] = previousMigrationsFolder;
  };

  const cleanup = async (): Promise<void> => {
    if (cleaned) return;
    cleaned = true;
    const errors: unknown[] = [];
    try {
      rawDb?.close();
    } catch (error) {
      errors.push(error);
    }
    try {
      resetDb();
    } catch (error) {
      errors.push(error);
    }
    restoreEnv();
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) throw new AggregateError(errors, "Failed to clean up integration test database");
  };

  try {
    // The migration module captures MIGRATIONS_FOLDER at import time, so load it only after test env setup.
    process.env["DB_FILE_NAME"] = dbFile;
    process.env["MIGRATIONS_FOLDER"] = migrationsFolder;
    const client = await import("../../db/client");
    resetDb();
    const { runMigrations } = await import("../../db/migrate");
    runMigrations();
    const drizzleDb = db as unknown as DrizzleDatabase;
    rawDb = drizzleDb.session?.client;
    if (!rawDb) throw new Error("Cannot access underlying SQLite database");

    const app = new Elysia()
      .use(cors())
      .use(authPlugin)
      .group("/api", (api) =>
        api
          .use(userRoutes)
          .use(profileRoutes)
          .use(gameRoutes)
          .use(mapRoutes)
          .group("/settings", (s) => s.use(settingsRoutes))
          .get("/health", () => ({ status: "ok" })),
      );
    return { app, rawDb, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export function seedUser(rawDb: Database, overrides?: Partial<SeedUser>): SeedUser {
  seedSequence += 1;
  const userId = overrides?.userId ?? `user_test_${seedSequence}`;
  const username = overrides?.username ?? `tu_test_${seedSequence}`;
  const password = overrides?.password ?? "testpass123";
  const hashed = hashPassword(password);
  rawDb.prepare("INSERT INTO users (id, username, email, password, verified) VALUES (?, ?, ?, ?, 1)").run(userId, username, `${username}@t.com`, hashed);
  rawDb.prepare("INSERT INTO profiles (user_id, display_name, updated_at) VALUES (?, ?, ?)").run(userId, username, 1_700_000_000_000 + seedSequence);
  return { userId, username, password };
}

export async function loginAs(app: Elysia, username: string, password: string) {
  const res = await app.handle(new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }));
  const body = await res.json();
  const sid = (res.headers.get("set-cookie") ?? "").match(/sid=([^;]+)/)?.[1] ?? "";
  return { sid, body, status: res.status };
}
