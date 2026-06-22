import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { logger } from "../lib/logger";
import * as setupCmd from "./commands/setup";
import * as ticketCmd from "./commands/ticket";
import * as vouchCmd from "./commands/vouch";
import * as helperProfileCmd from "./commands/helperprofile";
import { handleButton, handleModalSubmit, handleSelectMenu } from "./interactions";
import { UserMessageCount } from "./models/UserMessageCount";
import { deployCommands } from "./deploy-commands";

const commands = new Map([
  ["setup", setupCmd],
  ["ticket", ticketCmd],
  ["vouch", vouchCmd],
  ["helperprofile", helperProfileCmd],
]);

export function createBotClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once(Events.ClientReady, async (c) => {
    logger.info(`CarryBot online as ${c.user.tag}`);
    try {
      const guildIds = c.guilds.cache.map((g) => g.id);
      await deployCommands(guildIds);
      logger.info({ count: guildIds.length }, "Slash commands registered (guild-specific)");
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
  });

  // Track message counts
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guildId) return;
    try {
      await UserMessageCount.findOneAndUpdate(
        { guildId: message.guildId, userId: message.author.id },
        { $inc: { count: 1 } },
        { upsert: true }
      );
    } catch (err) {
      logger.error({ err }, "Failed to update message count");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const cmd = commands.get(interaction.commandName);
      if (!cmd) return;
      try {
        await cmd.execute(interaction as ChatInputCommandInteraction);
      } catch (err) {
        logger.error({ err, command: interaction.commandName }, "Command error");
        const payload = { content: "❌ An error occurred while running this command.", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      try {
        await handleButton(interaction as ButtonInteraction);
      } catch (err) {
        logger.error({ err, customId: (interaction as ButtonInteraction).customId }, "Button error");
        const payload = { content: "❌ Something went wrong.", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    // String select menus
    if (interaction.isStringSelectMenu()) {
      try {
        await handleSelectMenu(interaction as StringSelectMenuInteraction);
      } catch (err) {
        logger.error({ err, customId: (interaction as StringSelectMenuInteraction).customId }, "Select menu error");
        const payload = { content: "❌ Something went wrong.", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    // Modals
    if (interaction.isModalSubmit()) {
      try {
        await handleModalSubmit(interaction as ModalSubmitInteraction);
      } catch (err) {
        logger.error({ err, customId: (interaction as ModalSubmitInteraction).customId }, "Modal error");
        const payload = { content: "❌ Something went wrong.", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }
  });

  return client;
}

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) throw new Error("DISCORD_TOKEN is required");

  const client = createBotClient();
  await client.login(token);
}
