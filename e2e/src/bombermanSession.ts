import { expect, type Page, type Dialog } from "@playwright/test";
import type { TestUser } from "./testScenario";

/**
 * BombermanSession — Bomberman-specific Playwright page interactions.
 *
 * Bomberman uses a separate set of routes (/bomberman/room/:id) and UI
 * components from Generale. This helper encapsulates Bomberman DOM
 * interactions for E2E scenarios.
 *
 * Selectors target translated button text (English) — tests assume `en`
 * locale. When run against the built frontend, the i18n runtime resolves
 * keys like `"bomberman.ready"` → `"Ready"`.
 */
export class BombermanSession {
  constructor(
    public readonly page: Page,
    private readonly baseUrl: string,
    private readonly user?: TestUser,
  ) {
    // auto-dismiss dialogs
    this.page.on("dialog", async (d: Dialog) => {
      await d.accept();
    });
  }

  /** ── Auth ── */

  async login(username?: string, password?: string) {
    const u = username ?? this.user?.username;
    const p = password ?? this.user?.password;
    if (!u || !p) throw new Error("login: username and password required");

    await this.page.goto(`${this.baseUrl}/login?__test__=1`);
    await this.page.fill('[data-testid="login-username"]', u);
    await this.page.fill('[data-testid="login-password"]', p);
    await this.page.click('[data-testid="login-submit"]');
    await expect(this.page.getByText(u)).toBeVisible({ timeout: 10000 });
  }

  /** ── Room creation — navigates to Bomberman hub and creates a room ── */

  async createRoom(opts?: {
    roomName?: string;
    password?: string;
    matchFormat?: "single" | "bo3" | "bo5";
  }) {
    await this.page.goto(`${this.baseUrl}/bomberman?__test__=1`);
    // Click "Create Room" button on the hub
    await this.page.getByRole("button", { name: "Create Room" }).click();

    const name = opts?.roomName ?? `e2e-${Date.now()}`;
    // Fill room name via placeholder on the input element (LabelText is a <span>, not an input)
    await this.page.getByPlaceholder("Room Name", { exact: true }).fill(name);

    if (opts?.matchFormat && opts.matchFormat !== "single") {
      // Match Format is the only combobox containing the stable option value.
      // Avoid positional selectors: the hub has several independent selects.
      const formatSelect = this.page
        .getByRole("combobox")
        .filter({ has: this.page.locator(`option[value="${opts.matchFormat}"]`) });
      try {
        await expect(formatSelect).toHaveCount(1, { timeout: 5000 });
        await formatSelect.selectOption({ value: opts.matchFormat }, { timeout: 5000 });
      } catch (error) {
        await this.page.screenshot({ path: "e2e/screenshots/create-room-format-failed.png" }).catch(() => {});
        throw new Error(
          `createRoom: could not select match format "${opts.matchFormat}" using its stable option locator. ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (opts?.password) {
      await this.page.getByPlaceholder("Leave empty for public room").fill(opts.password);
    }

    await this.page.getByRole("button", { name: "Create", exact: true }).click();

    // Wait for navigation to room page
    await this.page.waitForURL(/\/bomberman\/room\//, { timeout: 15000 });
    await expect(this.page.locator("text=e2e").or(this.page.locator("text=test-alice")).first()).toBeVisible({
      timeout: 10000,
    });
  }

  /** ── Join an existing Bomberman room ── */

  async joinRoom(roomId: string) {
    const qs = `${this.baseUrl}/bomberman/room/${roomId}?__test__=1`;
    await this.page.goto(qs);
    await this.page.waitForURL(/\/bomberman\/room\//, { timeout: 15000 });
    await expect(this.page.locator("text=test-alice").or(this.page.locator("text=test-bob")).first()).toBeVisible({
      timeout: 10000,
    });
  }

  /** ── Ready up in Bomberman lobby ── */

  async readyUp() {
    // Hosts don't have a "Ready" button — they see a host badge + "Start Game".
    // Short bounded check; skip gracefully if button doesn't exist (host path).
    const btn = this.page.getByRole("button", { name: "Ready" });
    try {
      await btn.waitFor({ state: "visible", timeout: 3000 });
      await btn.click();
    } catch {
      // No "Ready" button visible — likely the host, which is correct.
    }
  }

  /** ── Start game (host only) — bounded wait with diagnostics ── */

  async startGame() {
    const btn = this.page.getByRole("button", { name: "Start Game" });
    try {
      await btn.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      throw new Error(
        "Start Game button not visible after 15s. " +
        "Frontend allReady() requires host to be ready too (players.every(p => p.ready)), " +
        "but host has no Ready button and backend rejects host READY. " +
        "Fix: allReady() in room.tsx should check only non-host players.",
      );
    }
    try {
      await btn.click({ timeout: 20000 });
    } catch {
      // Button visible but stayed disabled — gather player state for diagnostics
      const diag = await this.page.evaluate(() => {
        const players: { name: string; ready: boolean; isHost: boolean }[] = [];
        const testBridge = (window as unknown as Record<string, unknown>).__test__ as
          Record<string, unknown> | undefined;
        const rs = testBridge?.roomSync as { state?: () => { players?: unknown[] } } | undefined;
        const raw = rs?.state?.()?.players ?? [];
        for (const p of raw) {
          const pp = p as Record<string, unknown>;
          players.push({
            name: String(pp.name ?? ""),
            ready: Boolean(pp.ready),
            isHost: Boolean(pp.isHost),
          });
        }
        return players;
      }).catch(() => []);
      const readySummary = diag.map((p) =>
        `${p.name}(host=${p.isHost}, ready=${p.ready})`,
      ).join(", ");
      throw new Error(
        "Start Game button never became enabled after 20s. " +
        `Players: [${readySummary}]. ` +
        "Frontend allReady() requires every player including host to be ready, " +
        "but host cannot ready (no Ready button, backend rejects host READY). " +
        "Fix: allReady() in room.tsx should check only non-host players.",
      );
    }
  }

  /** ── Surrender during game ── */

  async surrender() {
    // Use short, bounded waits so a missing game HUD fails with a useful error.
    const hudSurrender = this.page.getByRole("button", { name: "Surrender" });
    try {
      await expect(hudSurrender.first()).toBeVisible({ timeout: 5000 });
      await hudSurrender.first().click({ force: true, timeout: 5000 });
      await expect(hudSurrender.nth(1)).toBeVisible({ timeout: 5000 });
      await hudSurrender.nth(1).click({ timeout: 5000 });
      await expect(this.page.getByRole("button", { name: "Yes, Surrender" })).toBeVisible({ timeout: 5000 });
      await this.page.getByRole("button", { name: "Yes, Surrender" }).click({ timeout: 5000 });
      await this.page.waitForTimeout(500);
    } catch (error) {
      await this.page.screenshot({ path: "e2e/screenshots/surrender-failed.png" }).catch(() => {});
      throw new Error(
        `surrender: game surrender controls did not complete on ${this.page.url()}. ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** ── Leave room after match ── */

  async leaveRoom() {
    await this.page.getByRole("button", { name: "Back to Room" }).click();
  }

  /** ── Back to lobby ── */

  async backToLobby() {
    await this.page.getByRole("button", { name: "Back to Lobby" }).click();
  }

  /** ── Spectate helpers ── */

  async enterSpectate() {
    await this.page.getByRole("button", { name: "Watch Game" }).click();
  }

  async leaveSpectate() {
    await this.page.getByRole("button", { name: "Leave Spectate" }).click();
  }
  /** ── Wait helpers ── */

  async waitForPlaying(timeout = 20000) {
    // Try to find the Surrender button — indicates game UI has rendered
    const deadline = Date.now() + timeout;
    let lastErr: Error | undefined;
    while (Date.now() < deadline) {
      try {
        await expect(this.page.getByRole("button", { name: "Surrender" }).first()).toBeVisible({ timeout: 3000 });
        return;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    // Timeout — capture diagnostics before failing
    const bodyText = await this.page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    const url = this.page.url();
    await this.page.screenshot({ path: `e2e/screenshots/waitForPlaying-timeout.png`, fullPage: false }).catch(() => {});
    throw new Error(
      `waitForPlaying timed out after ${timeout}ms. ` +
      `URL: ${url}. ` +
      `Body text: ${bodyText.slice(0, 300)}. ` +
      `Original error: ${lastErr?.message ?? "unknown"}`,
    );
  }

  async waitForBetweenRounds(timeout = 15000) {
    // The service gives the next round a five-second deadline; keep this bounded.
    const deadline = Date.now() + timeout;
    let lastErr: Error | undefined;
    while (Date.now() < deadline) {
      try {
        await expect(this.page.getByText("Next round in", { exact: false }).first()).toBeVisible({ timeout: 2000 });
        return;
      } catch (error) {
        lastErr = error instanceof Error ? error : new Error(String(error));
      }
    }
    const bodyText = await this.page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    await this.page.screenshot({ path: "e2e/screenshots/waitForBetweenRounds-timeout.png" }).catch(() => {});
    throw new Error(
      `waitForBetweenRounds timed out after ${timeout}ms at ${this.page.url()}. ` +
        `Body text: ${bodyText.slice(0, 500)}. ` +
        `Last assertion: ${lastErr?.message ?? "unknown"}`,
    );
  }

  async waitForMatchEnded(timeout = 15000) {
    // Match ended: the Scoreboard component with "Back to Room" button.
    const deadline = Date.now() + timeout;
    let lastErr: Error | undefined;
    while (Date.now() < deadline) {
      try {
        await expect(this.page.getByRole("button", { name: "Back to Room" })).toBeVisible({ timeout: 2000 });
        return;
      } catch (error) {
        lastErr = error instanceof Error ? error : new Error(String(error));
      }
    }
    const bodyText = await this.page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
    await this.page.screenshot({ path: "e2e/screenshots/waitForMatchEnded-timeout.png" }).catch(() => {});
    throw new Error(
      `waitForMatchEnded timed out after ${timeout}ms at ${this.page.url()}. ` +
        `Body text: ${bodyText.slice(0, 500)}. ` +
        `Last assertion: ${lastErr?.message ?? "unknown"}`,
    );
  }


  /** ── Assertions ── */

  async expectScoreRow(playerName: string, wins: number, targetWins: number) {
    const expectedScore = `${wins} / ${targetWins}`;
    const scoreSection = this.page.getByTestId("bomberman-between-rounds-score");
    try {
      // The between-rounds phase can render before its score state patch arrives.
      await expect(scoreSection).toBeVisible({ timeout: 10000 });
      const scoreRow = scoreSection.getByText(playerName, { exact: true }).locator("..");
      await expect(scoreRow).toContainText(expectedScore, { timeout: 10000 });
    } catch (error) {
      await this.page.screenshot({ path: "e2e/screenshots/score-row-failed.png" }).catch(() => {});
      const bodyText = await this.page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      throw new Error(
        `expectScoreRow: expected player "${playerName}" with score "${expectedScore}" at ${this.page.url()}. ` +
          `Body text: ${bodyText.slice(0, 500)}. ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async expectRoundNumber(round: number) {
    await expect(this.page.locator(`text=Round ${round}`).first()).toBeVisible();
  }

  async expectMatchPoint(playerName: string) {
    await expect(this.page.locator("text=Match Point!").first()).toBeVisible();
  }

  async expectChampion(playerName: string) {
    // Champion banner in Scoreboard
    await expect(this.page.locator("text=Champion").first()).toBeVisible();
  }

  /** ── Room ID from URL ── */

  async getRoomId(): Promise<string> {
    const url = this.page.url();
    const match = url.match(/\/bomberman\/room\/([^/?]+)/);
    if (match) return match[1];
    return "";
  }

  /** ── Screenshot ── */

  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `e2e/screenshots/${name}.png`,
      fullPage: false,
    });
  }
}
