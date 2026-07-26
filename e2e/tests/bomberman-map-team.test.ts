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
 * bomberman-map-team.test.ts — Team mode and map configuration
 *
 * Tests:
 *  - Two players create a room
 *  - Host enables Team mode via settings
 *  - Team assignment UI visible with team switch buttons
 *  - Players can be moved to opposite teams
 *  - Game starts and team mode gameplay is active
 *
 * Blocker notes:
 *  - Bomberman map editor UI at /bomberman/maps/editor/:id does not exist yet
 *    (only Generale map editor at /maps/editor is available)
 *  - Workshop map selection/rotation in CreateRoomModal not implemented
 *  - Map publish/validation UI for Bomberman format not built
 *  - Bot configuration in CreateRoomModal not implemented (no botCount UI)
 *  - This test focuses on executable Team mode verification;
    map creation/validation round-trip is covered by packages/backend/src/__tests__/routes/map.integration.test.ts ("POST then GET /maps/detail/:id — preserves a Bomberman map").
 */
test.describe("Bomberman Team Mode", () => {
  let scenario: TestScenario;

  test.beforeEach(async ({}, testInfo) => {
    scenario = new TestScenario(testInfo);
    await scenario.start(BACKEND_DIR, FRONTEND_DIR);
  });

  test.afterEach(async () => {
    await scenario.stop();
  });

  test("team mode: assign teams, verify markers, play and end match", async () => {
    const users = scenario.testUsers;
    const p1 = new BombermanSession(
      (await scenario.createSession(users[0])).page,
      scenario.frontendUrl(),
      users[0],
      scenario.outputPath,
    );
    const p2 = new BombermanSession(
      (await scenario.createSession(users[1])).page,
      scenario.frontendUrl(),
      users[1],
      scenario.outputPath,
    );

    // ── Login ──
    await p1.login();
    await p2.login();

    // ── p1 creates room ──
    await p1.createRoom({ roomName: "team-mode-e2e" });
    const roomId = await p1.getRoomId();
    expect(roomId).toBeTruthy();

    // ── p2 joins ──
    await p2.joinRoom(roomId);

    // ── p1 opens settings and switches to Team mode ──
    await p1.enableTeamMode();

    // Team assignment controls are exposed for both lobby players once team mode is active.
    await expect(p1.page.getByRole("button", { name: "A", exact: true })).toHaveCount(2);
    await expect(p1.page.getByRole("button", { name: "B", exact: true })).toHaveCount(2);
    await p1.page.getByRole("button", { name: "B", exact: true }).nth(1).click();
    await expect(p1.page.getByText("triangle", { exact: true })).toHaveCount(1);



    // p2 readies up
    await p2.readyUp();

    await p1.startGame();

    // Wait for game to start
    await p1.waitForPlaying(25000);
    await p2.waitForPlaying(25000);


    // ── p2 surrenders → p1's team wins ──
    await p2.surrender();

    // Wait for match end
    await p1.waitForMatchEnded(30000);


    // ── Back to room ──
    await p1.leaveRoom();
  });

});

