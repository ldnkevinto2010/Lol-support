import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { connectDB } from "./bot/db";
import { startBot } from "./bot/client";

const rawPort = process.env["PORT"];
const port = rawPort ? Number(rawPort) : 3000;

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Start MongoDB + Discord bot (only in production — set NODE_ENV=production on bothosting)
if (process.env.NODE_ENV === "production") {
  (async () => {
    try {
      await connectDB();
      await startBot();
    } catch (err) {
      logger.error({ err }, "Failed to start bot — check MONGODB_URI network access and DISCORD_TOKEN");
    }
  })();
} else {
  logger.info("Skipping Discord bot in development mode (NODE_ENV != production)");
}
