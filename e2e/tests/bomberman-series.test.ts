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
 * bomberman-series.test.ts — BO3 series lifecycle
 *
 * Tests:
 *  - Two players create a BO3 room
 *  - Round 1: p2 surrenders → p1=1, between_rounds
 *  - p2 refreshes in between_rounds → same score
 *  - Round 2: p1 surrenders → 1:1
 *  - Round 3: p2 surrenders → p1 wins series → champion screen
 *  - Back to lobby resets for next match
 *
 * Blocker notes:
 *  - "between_rounds" phase and score persistence depend on backend
 *    MATCH_ENDED/ROUND_ENDED events — test asserts what the UI renders
 *  - Screenshots are taken at key states
 */
test.describe("Bomberman BO3 Series", () => {
  let scenario: TestScenario;

  test.beforeEach(async () => {
    scenario = new TestScenario();
    await scenario.start(BACKEND_DIR, FRONTEND_DIR);
  });

  test.afterEach(async () => {
    await scenario.stop();
  });

  test("BO3 series: surrender round-robin, verify scores, champion, and lobby return", async () => {
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

    // ── Login both ──
    await p1.login();
    await p2.login();

    // ── p1 creates a deterministic BO3 room ──
    await p1.createRoom({
      roomName: "series-e2e",
      matchFormat: "bo3",
    });
    const roomId = await p1.getRoomId();
    expect(roomId).toBeTruthy();
    await p1.screenshot("bo3-room-created");

    // ── p2 joins ──
    await p2.joinRoom(roomId);

    // ── Both ready up (host has no Ready button — only non-host readies) ──
    await p2.readyUp();

    // ── p1 starts round 1 ──
    await p1.startGame();
    await Promise.all([
      p1.waitForPlaying(20000),
      p2.waitForPlaying(20000),
    ]);
    await p1.screenshot("bo3-round1-playing");

    // ── Round 1: p2 surrenders, then verify the 1:0 score ──
    await p2.surrender();
    await p1.waitForBetweenRounds(12000);

    // Reload p2 immediately while the room is between rounds; the score must survive refresh.
    // Done before score assertions to stay within the 5-second server deadline.
    await p2.page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
    await p2.page.waitForURL(/\/bomberman\/room\//, { timeout: 10000 });
    await p2.waitForBetweenRounds(10000);

    // Concurrent bounded score assertions — each has a 10s timeout but run in parallel.
    await Promise.all([
      p1.expectScoreRow(users[0].username, 1, 2),
      p1.expectScoreRow(users[1].username, 0, 2),
      p2.expectScoreRow(users[0].username, 1, 2),
      p2.expectScoreRow(users[1].username, 0, 2),
    ]);
    await p1.screenshot("bo3-round1-between-rounds");
    await p2.screenshot("bo3-round1-refresh-between-rounds");

    // ── Round 2: p1 surrenders, producing a 1:1 match-point score ──
    await Promise.all([
      p1.waitForPlaying(12000),
      p2.waitForPlaying(12000),
    ]);
    await p1.screenshot("bo3-round2-playing");
    await p1.surrender();
    await Promise.all([
      p1.waitForBetweenRounds(12000),
      p2.waitForBetweenRounds(12000),
    ]);
    await Promise.all([
      p1.expectScoreRow(users[0].username, 1, 2),
      p1.expectScoreRow(users[1].username, 1, 2),
      p2.expectScoreRow(users[0].username, 1, 2),
      p2.expectScoreRow(users[1].username, 1, 2),
    ]);
    await p1.screenshot("bo3-round2-between-rounds");

    // ── Round 3: p2 surrenders, ending the BO3 series for p1 ──
    await Promise.all([
      p1.waitForPlaying(12000),
      p2.waitForPlaying(12000),
    ]);
    await p1.screenshot("bo3-round3-playing");
    await p2.surrender();
    await Promise.all([
      p1.waitForMatchEnded(12000),
      p2.waitForMatchEnded(12000),
    ]);
    await p1.expectChampion(users[0].username);
    await p1.screenshot("bo3-match-ended");

    // ── p1 returns to the room lobby ──
    await p1.leaveRoom();
    await p1.screenshot("bo3-back-to-lobby");
  });
});
