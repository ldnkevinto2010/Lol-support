import { REST, Routes } from "discord.js";
import * as setupCmd from "./commands/setup";
import * as ticketCmd from "./commands/ticket";
import * as vouchCmd from "./commands/vouch";
import * as helperProfileCmd from "./commands/helperprofile";

export async function deployCommands(guildIds: string[]): Promise<void> {
  const token = process.env["DISCORD_TOKEN"];
  const clientId = process.env["DISCORD_CLIENT_ID"];

  if (!token || !clientId) {
    throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required");
  }

  const commands = [
    setupCmd.data.toJSON(),
    ticketCmd.data.toJSON(),
    vouchCmd.data.toJSON(),
    helperProfileCmd.data.toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(token);

  // Clear any previously registered global commands to avoid duplicates
  await rest.put(Routes.applicationCommands(clientId), { body: [] });

  // Register per-guild for instant propagation (no 1-hour global delay)
  await Promise.all(
    guildIds.map((guildId) =>
      rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    )
  );
}
