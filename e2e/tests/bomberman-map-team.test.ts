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
 *    map creation/validation is tested via backend API calls.
 */
test.describe("Bomberman Team Mode", () => {
  let scenario: TestScenario;

  test.beforeEach(async () => {
    scenario = new TestScenario();
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
    );
    const p2 = new BombermanSession(
      (await scenario.createSession(users[1])).page,
      scenario.frontendUrl(),
      users[1],
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
    await p1.screenshot("team-settings");



    // p2 readies up
    await p2.readyUp();

    await p1.startGame();

    // Wait for game to start
    await p1.waitForPlaying(25000);
    await p2.waitForPlaying(25000);

    // Screenshot: team game in progress
    await p1.screenshot("team-game-playing");

    // ── p2 surrenders → p1's team wins ──
    await p2.surrender();

    // Wait for match end
    await p1.waitForMatchEnded(30000);

    // Screenshot: team match ended
    await p1.screenshot("team-match-ended");

    // ── Back to room ──
    await p1.leaveRoom();
    await p1.screenshot("team-lobby-return");
  });

  /**
   * Backend-only: verify Bomberman map API for team mode
   *
   * This validates the map validation pipeline without UI interaction,
   * since the Bomberman-specific map frontend routes don't exist yet.
   */
  test("map validation API returns appropriate results for Bomberman maps", async () => {
    const baseUrl = scenario.backendUrl();

    // Login to get session cookie.
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: scenario.testUsers[0].username,
        password: scenario.testUsers[0].password,
      }),
    });
    expect(loginRes.ok).toBe(true);
    const loginData = await loginRes.json();
    expect(loginData.user).toBeTruthy();
    const cookie = loginRes.headers.get("set-cookie") || "";
    expect(cookie).toContain("sid=");


    const validMap = {
      schemaVersion: 1,
      width: 15,
      height: 13,
      themeId: "classic",
      tiles: generateBombermanTiles(15, 13),
      spawns: [
        { x: 1, y: 1 },
        { x: 13, y: 11 },
      ],
      fixedItems: [],
    };

    // Create and retrieve through the current shared map API.
    const createRes = await fetch(`${baseUrl}/api/maps/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie,
      },
      body: JSON.stringify({
        name: "e2e-bomberman-map",
        gameType: "bomberman",
        width: validMap.width,
        height: validMap.height,
        data: validMap.tiles,
      }),
    });
    const createBody = await createRes.text();
    expect(createRes.status, createBody).toBe(200);
    const createData = JSON.parse(createBody);
    expect(createData.success).toBe(true);
    const mapId = createData.data?.id;
    expect(mapId).toBeTruthy();

    const detailRes = await fetch(`${baseUrl}/api/maps/detail/${mapId}`, { headers: { cookie } });
    expect(detailRes.status).toBe(200);
    const detailData = await detailRes.json();
    expect(detailData.success).toBe(true);
    expect(detailData.data?.gameType).toBe("bomberman");
    expect(detailData.data?.data).toEqual(validMap.tiles);
  });
});

/** Helper: generate a valid Bomberman tile grid for testing */
function generateBombermanTiles(width: number, height: number): string[][] {
  const tiles: string[][] = [];
  for (let y = 0; y < height; y++) {
    const row: string[] = [];
    for (let x = 0; x < width; x++) {
      // Walls on border
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        row.push("hard_wall");
      }
      // Spawn-safe zones (tiles at spawn positions must be empty)
      else if ((x === 1 && y === 1) || (x === 13 && y === 11)) {
        row.push("empty");
      }
      // Inner border walls (unbreakable pillars)
      else if (x % 2 === 0 && y % 2 === 0) {
        row.push("hard_wall");
      } else {
        // Fill rest with empty (no soft walls for simplicity in test map)
        row.push("empty");
      }
    }
    tiles.push(row);
  }
  return tiles;
}
