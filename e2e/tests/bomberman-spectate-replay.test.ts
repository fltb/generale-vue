import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TestScenario } from "../src/testScenario";
import { BombermanSession } from "../src/bombermanSession";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_DIR = resolve(__dirname, "../../packages/backend");
const FRONTEND_DIR = resolve(__dirname, "../../packages/frontend");

/**
 * bomberman-spectate-replay.test.ts — Spectator and replay lifecycle
 *
 * Tests:
 *  - p1/p2 start a single match
 *  - p3 joins as spectator (role=spectator)
 *  - Spectator sees full game state but cannot interact
 *  - p2 surrenders, match ends
 *  - p1 retrieves replay from backend API
 *
 * Blocker note:
 *  - Frontend `/bomberman/replays` route does not exist yet (nav link present
 *    in BombermanLayout but no Route in app.tsx).
 *  - Replay assertion is done via direct backend API call instead of UI navigation.
 *  - This test verifies the backend replay recording pipeline works end-to-end.
 */
test.describe("Bomberman Spectate + Replay", () => {
  let scenario: TestScenario;

  test.beforeEach(async () => {
    scenario = new TestScenario();
    await scenario.start(BACKEND_DIR, FRONTEND_DIR);
  });

  test.afterEach(async () => {
    await scenario.stop();
  });

  test("spectator joins live game, match ends, replay retrievable from API", async () => {
    const users = scenario.testUsers;
    const p1 = new BombermanSession(
      (await scenario.createSession(users[0])).page,
      scenario.frontendUrl(),
      users[0],
    );
    const p2 = new BombermanSession(
      (await scenario.createSession(users[1])).page,
      scenario.frontendUrl(),
      users[1],
    );
    const p3 = new BombermanSession(
      (await scenario.createSession(users[2])).page,
      scenario.frontendUrl(),
      users[2],
    );

    // ── All login ──
    await p1.login();
    await p2.login();
    await p3.login();

    // ── p1 creates single-match room ──
    await p1.createRoom({ roomName: "spectate-replay-e2e" });
    const roomId = await p1.getRoomId();
    expect(roomId).toBeTruthy();

    // ── p2 joins ──
    await p2.joinRoom(roomId);

    // ── Ready and start ──
    await p2.readyUp();
    await p1.readyUp();
    await p1.startGame();

    // Wait for game to start
    await p1.waitForPlaying(25000);
    await p2.waitForPlaying(25000);

    // Screenshot: game in progress
    await p1.screenshot("spectate-game-active");

    // ── p3 joins as a server-resolved spectator via URL ──
    // Spectator connections must opt into role=spectator before the room
    // sync opens; a default player connection is rejected once the match starts.
    await p3.joinRoom(roomId, { role: "spectator" });

    // The current room UI keeps the in-progress alert visible for spectators
    // and exposes Leave Spectate instead of the lobby-only Watch Game action.
    await expect(p3.page.getByText("Game in Progress", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(p3.page.getByRole("button", { name: "Leave Spectate" }).first()).toBeVisible({ timeout: 10000 });
    await expect(p3.page.getByText("You are spectating.", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(p3.page.getByText("Spectating", { exact: true }).first()).toBeVisible({ timeout: 10000 });
    await expect(p3.page.getByRole("button", { name: "Surrender" })).toHaveCount(0);

    // Screenshot: spectator view
    await p3.screenshot("spectate-active-view");

    // ── p2 surrenders → match ends ──
    await p2.surrender();

    // Wait for match end on p1's screen
    await p1.waitForMatchEnded(30000);

    // Screenshot: match ended
    await p1.screenshot("spectate-match-ended");

    // ── Verify replay via backend API ──
    // NOTE: This is a backend assertion since frontend replays route doesn't exist
    const baseUrl = scenario.backendUrl();
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: users[0].username,
        password: users[0].password,
      }),
    });
    expect(loginRes.ok).toBe(true);
    await loginRes.json();
    const cookie = loginRes.headers.get("set-cookie") || "";

    // List replays for p1
    const replaysRes = await fetch(`${baseUrl}/api/bomberman/replays?limit=10`, {
      headers: { cookie },
    });
    const replaysData = await replaysRes.json();
    expect(replaysData.success).toBe(true);
    expect(Array.isArray(replaysData.data)).toBe(true);

    // The completed match must be listed for p1, with a retrievable full replay.
    expect(replaysData.data.length).toBeGreaterThan(0);
    const replay = replaysData.data[0];
    expect(replay.format).toBe("single");
    // p1 should be the winner since p2 surrendered.

    const replayDetailRes = await fetch(`${baseUrl}/api/bomberman/replays/${replay.id}`, {
      headers: { cookie },
    });
    expect(replayDetailRes.ok).toBe(true);
    const replayDetailData = await replayDetailRes.json();
    expect(replayDetailData.success).toBe(true);
    expect(replayDetailData.data.schemaVersion).toBe(1);
    expect(replayDetailData.data.rounds.length).toBe(1);
    expect(replayDetailData.data.result.winner).toBeTruthy();

    // Screenshot placeholder for replay page (not available via frontend)
    await p1.screenshot("replay-api-verified");

    // ── p1 clicks "Back to Room" ──
    await p1.leaveRoom();
    await p1.screenshot("spectate-lobby-return");
  });
});
