import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TestScenario } from "../src/testScenario";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = resolve(__dirname, "../../packages/backend");
const FRONTEND_DIR = resolve(__dirname, "../../packages/frontend");

test.describe("Disconnection & Reconnection", () => {
  let scenario: TestScenario;

  test.beforeEach(async ({}, testInfo) => {
    scenario = new TestScenario(testInfo);
    await scenario.start(BACKEND_DIR, FRONTEND_DIR);
  });

  test.afterEach(async () => {
    await scenario.stop();
  });

  test("player disconnects and reconnects during game", async () => {
    const [p1, p2] = await Promise.all([
      scenario.createSession(scenario.testUsers[0]),
      scenario.createSession(scenario.testUsers[1]),
    ]);

    await p1.login();
    await p2.login();

    // Create and start game
    await p1.createRoom({ roomName: "dc-test" });
    const roomId = await p1.getRoomId();
    expect(roomId).toBeTruthy();

    await p2.page.goto(`${scenario.frontendUrl()}/generale/room/${roomId}?__test__=1`);
    await p2.page.waitForURL(/\/generale\/room\//);
    await expect(p2.page.locator('[data-testid="player-list"]')).toBeVisible({ timeout: 10000 });

    await p2.readyUp();
    await p1.page.click('[data-testid="start-game"]');

    // Wait for game to start
    await p1.waitForStatus("PLAYING");
    await p2.waitForStatus("PLAYING");
    await expect(p1.page.locator('[data-testid="game-hud"]')).toBeVisible({ timeout: 10000 });

    // Simulate a real network drop instead of reaching into ws internals.
    await p1.waitForConnectionState("connected");

    await p1.page.context().setOffline(true);
    await p1.waitForConnectionState("reconnecting", 20000);

    await p1.page.context().setOffline(false);
    await p1.waitForConnectionState("connected", 20000);

    // Verify game is still running after reconnect
    const stateAfter = await p1.getGameState();
    expect(stateAfter).toBeTruthy();
    expect(stateAfter?.status).toBe("PLAYING");
  });
});
