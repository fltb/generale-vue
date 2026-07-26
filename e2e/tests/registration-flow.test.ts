import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { TestScenario } from "../src/testScenario";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_DIR = resolve(__dirname, "../../packages/backend");
const FRONTEND_DIR = resolve(__dirname, "../../packages/frontend");

test.describe("Registration Flow", () => {
  let scenario: TestScenario;

  test.beforeEach(async ({}, testInfo) => {
    scenario = new TestScenario(testInfo);
    await scenario.start(BACKEND_DIR, FRONTEND_DIR);
  });

  test.afterEach(async () => {
    await scenario.stop();
  });

  test("register new user, then login as seeded user and create room", async () => {
    const alice = await scenario.createSession(scenario.testUsers[0]);
    const baseUrl = scenario.frontendUrl();

    // Navigate to login page
    await alice.page.goto(`${baseUrl}/login?__test__=1`);
    await expect(alice.page.locator('[data-testid="login-username"]')).toBeVisible();

    // Switch to registration tab
    await alice.page.getByText("Register here").click();
    await expect(alice.page.locator('input[placeholder="Username"]')).toBeVisible();

    // Fill registration form
    const username = `regtest_${Date.now()}`;
    await alice.page.fill('input[placeholder="Username"]', username);
    await alice.page.fill('input[placeholder="Email"]', `${username}@test.com`);
    await alice.page.fill('input[placeholder="Password"]', 'TestPass123!');
    await alice.page.check('input[type="checkbox"]');
    await alice.page.click('button[type="submit"]');

    // Check for success message (email "sent" — backend returns success even if SMTP not configured)
    await expect(alice.page.locator('.alert.alert-success')).toBeVisible({ timeout: 10000 });

    // Login as pre-seeded test user (test-alice) and create room to verify full flow
    await alice.login();
    await alice.createRoom({ roomName: "post-reg-room" });
    const roomId = await alice.getRoomId();
    expect(roomId).toBeTruthy();
  });
});
