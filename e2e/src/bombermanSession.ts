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
    private readonly user: TestUser | undefined,
    private readonly outputPath: (name: string) => string,
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
        await this.page.screenshot({ path: this.outputPath("create-room-format-failed.png") }).catch(() => {});
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

  async joinRoom(roomId: string, opts?: { role?: "player" | "spectator" }) {
    const roleQuery = opts?.role && opts.role !== "player" ? `&role=${encodeURIComponent(opts.role)}` : "";
    const qs = `${this.baseUrl}/bomberman/room/${roomId}?__test__=1${roleQuery}`;
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
  /** ── Team-mode lobby controls (host only) ── */

  async enableTeamMode() {
    // The navigation also has a Settings button; scope to the room main content
    // so this opens the host's room settings rather than global keybindings.
    const settings = this.page.getByRole("main").getByRole("button", { name: /Settings/ }).first();
    await expect(settings).toBeVisible({ timeout: 5000 });
    await settings.click();

    // The option value is the stable contract; avoid depending on the settings-grid order.
    const teamMode = this.page
      .getByRole("combobox")
      .filter({ has: this.page.locator('option[value="team"]') });
    await expect(teamMode).toHaveCount(1, { timeout: 5000 });
    await teamMode.selectOption({ value: "team" });
    await expect(teamMode).toHaveValue("team");
  }



  /** ── Start game (host only) — bounded wait with diagnostics ── */

  async startGame() {
    const button = this.page.getByRole("button", { name: "Start Game", exact: true });
    try {
      await expect(button).toBeVisible({ timeout: 10000 });
      await expect(button).toBeEnabled({ timeout: 10000 });
      await button.click();
    } catch (error) {
      const bodyText = await this.page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      throw new Error(
        `startGame: Start Game was not available on ${this.page.url()}. ` +
          `Body text: ${bodyText.slice(0, 500)}. ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** ── Surrender during game ── */

  async surrender() {
    try {
      const hudSurrender = this.page.getByRole("button", { name: "Surrender", exact: true }).first();
      await expect(hudSurrender).toBeVisible({ timeout: 5000 });
      await hudSurrender.click();

      // The menu has a second Surrender action; use the last visible one instead of
      // relying on a fixed index as the overlay implementation evolves.
      const menuSurrender = this.page.getByRole("button", { name: "Surrender", exact: true }).last();
      await expect(menuSurrender).toBeVisible({ timeout: 5000 });
      await menuSurrender.click();

      const confirm = this.page.getByRole("button", { name: "Yes, Surrender", exact: true });
      await expect(confirm).toBeVisible({ timeout: 5000 });
      await confirm.click();
    } catch (error) {
      await this.page.screenshot({ path: this.outputPath("surrender-failed.png") }).catch(() => {});
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
    const surrender = this.page.getByRole("button", { name: "Surrender", exact: true }).first();
    try {
      await expect(surrender).toBeVisible({ timeout });
    } catch (error) {
      const bodyText = await this.page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      await this.page.screenshot({ path: this.outputPath("waitForPlaying-timeout.png"), fullPage: false }).catch(() => {});
      throw new Error(
        `waitForPlaying timed out after ${timeout}ms at ${this.page.url()}. ` +
          `Body text: ${bodyText.slice(0, 300)}. ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
    await this.page.screenshot({ path: this.outputPath("waitForBetweenRounds-timeout.png") }).catch(() => {});
    throw new Error(
      `waitForBetweenRounds timed out after ${timeout}ms at ${this.page.url()}. ` +
        `Body text: ${bodyText.slice(0, 500)}. ` +
        `Last assertion: ${lastErr?.message ?? "unknown"}`,
    );
  }

  async waitForMatchEnded(timeout = 15000) {
    try {
      await expect(this.page.getByRole("button", { name: "Back to Room", exact: true })).toBeVisible({ timeout });
    } catch (error) {
      const bodyText = await this.page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      await this.page.screenshot({ path: this.outputPath("waitForMatchEnded-timeout.png") }).catch(() => {});
      throw new Error(
        `waitForMatchEnded timed out after ${timeout}ms at ${this.page.url()}. ` +
          `Body text: ${bodyText.slice(0, 500)}. ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
      await this.page.screenshot({ path: this.outputPath("score-row-failed.png") }).catch(() => {});
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

}
