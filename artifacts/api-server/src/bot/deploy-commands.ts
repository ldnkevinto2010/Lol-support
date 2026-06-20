import { REST, Routes } from "discord.js";
import * as setupCmd from "./commands/setup";
import * as ticketCmd from "./commands/ticket";
import * as vouchCmd from "./commands/vouch";

export async function deployCommands(): Promise<void> {
  const token = process.env["DISCORD_TOKEN"];
  const clientId = process.env["DISCORD_CLIENT_ID"];

  if (!token || !clientId) {
    throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID are required");
  }

  const commands = [
    setupCmd.data.toJSON(),
    ticketCmd.data.toJSON(),
    vouchCmd.data.toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationCommands(clientId), { body: commands });
}
