import { createApp } from "./app";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const app = await createApp();

app.listen({
  port: process.env["PORT"] || 3000,
  hostname: process.env["HOST"] || "0.0.0.0",
});

console.log(`🦊 Generale Game Server is running at ${app.server?.hostname}:${app.server?.port}`);

let shuttingDown = false;

process.on("SIGTERM", async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  try {
    await app.stop();
    process.exit(0);
  } catch (err) {
    console.error("Shutdown error:", err);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nReceived SIGINT, shutting down gracefully...");
  try {
    await app.stop();
    process.exit(0);
  } catch (err) {
    console.error("Shutdown error:", err);
    process.exit(1);
  }
});
