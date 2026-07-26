import type { ChildProcess } from "node:child_process";

/**
 * Send SIGTERM, wait up to `timeoutMs` for exit, escalate to SIGKILL if it
 * hasn't exited, and only resolve once the process has actually exited (or
 * was already dead). Replaces the old "kill + race a flat timeout that
 * resolves regardless" pattern, which could leave zombies behind.
 */
export async function stopProcess(
  proc: ChildProcess,
  timeoutMs = 5000,
): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) return;

  const exited = new Promise<void>((resolve) => {
    proc.once("exit", () => resolve());
  });

  proc.kill("SIGTERM");

  let timedOut = false;
  await Promise.race([
    exited,
    new Promise<void>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
    }),
  ]);

  if (timedOut && proc.exitCode === null && proc.signalCode === null) {
    proc.kill("SIGKILL");
    await exited;
  }
}
