import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TestScenario } from "../src/testScenario";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKEND_DIR = resolve(__dirname, "../../packages/backend");
const FRONTEND_DIR = resolve(__dirname, "../../packages/frontend");

test.describe("Room Management", () => {
  let scenario: TestScenario;

  test.beforeEach(async ({}, testInfo) => {
    scenario = new TestScenario(testInfo);
    await scenario.start(BACKEND_DIR, FRONTEND_DIR);
  });

  test.afterEach(async () => {
    await scenario.stop();
  });

  test("host transfer changes authority; new host can kick", async () => {
    const [p1, p2] = await Promise.all([
      scenario.createSession(scenario.testUsers[0]),
      scenario.createSession(scenario.testUsers[1]),
    ]);

    await p1.login();
    await p2.login();

    // p1 creates room
    await p1.createRoom({ roomName: "transfer-kick-test" });
    const roomId = await p1.getRoomId();
    expect(roomId).toBeTruthy();

    // p2 joins
    await p2.page.goto(`${scenario.frontendUrl()}/generale/room/${roomId}?__test__=1`);
    await p2.page.waitForURL(/\/generale\/room\//);
    await expect(p2.page.locator('[data-testid="player-list"]')).toBeVisible({ timeout: 10000 });

    // p1 transfers host to p2
    const transferBtn = p1.page.locator('[data-testid="transfer-host"]').first();
    await expect(transferBtn).toBeVisible({ timeout: 5000 });
    await transferBtn.click();

    // Deterministic signal that authority actually moved: p1 loses host controls.
    await expect(p1.page.locator('[data-testid="start-game"]')).not.toBeVisible({ timeout: 5000 });

    // p2 (now host) can kick — proves the transfer actually granted authority,
    // not just that p1's own UI updated.
    const kickBtn = p2.page.locator('[data-testid="kick-player"]').first();
    await expect(kickBtn).toBeVisible({ timeout: 5000 });
    await kickBtn.click();

    await p1.page.waitForURL(/\//, { timeout: 10000 });
  });

  test("host can kick a player", async () => {
    const [p1, p2] = await Promise.all([
      scenario.createSession(scenario.testUsers[0]),
      scenario.createSession(scenario.testUsers[1]),
    ]);

    await p1.login();
    await p2.login();

    // p1 creates room
    await p1.createRoom({ roomName: "kick-test" });
    const roomId = await p1.getRoomId();
    expect(roomId).toBeTruthy();

    // p2 joins
    await p2.page.goto(`${scenario.frontendUrl()}/generale/room/${roomId}?__test__=1`);
    await p2.page.waitForURL(/\/generale\/room\//);
    await expect(p2.page.locator('[data-testid="player-list"]')).toBeVisible({ timeout: 10000 });

    // Verify both players visible
    await p1.expectPlayerCount(2);

    // p1 kicks p2
    await p1.page.click('[data-testid="kick-player"]');

    // p2 should be removed — player count drops to 1
    await p1.expectPlayerCount(1);
  });
});
