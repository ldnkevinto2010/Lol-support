import app from "./app";
import { logger } from "./lib/logger";
import { connectDB } from "./bot/db";
import { startBot } from "./bot/client";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Start MongoDB + Discord bot
(async () => {
  try {
    await connectDB();
    await startBot();
  } catch (err) {
    logger.error({ err }, "Failed to start bot — check MONGODB_URI network access and DISCORD_TOKEN");
    // Don't exit — keep the HTTP server running so the workflow stays alive
  }
})();
