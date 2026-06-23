import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType,
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig";

export const data = new SlashCommandBuilder()
  .setName("applicationpanel")
  .setDescription("Post the helper application panel in a channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((opt) =>
    opt
      .setName("channel")
      .setDescription("Channel to post the panel in (defaults to current channel)")
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const config = await GuildConfig.findOne({ guildId: interaction.guildId });
  const games = config?.supportedGames ?? [];
  const imageUrl = config?.applicationPanelImageUrl ?? null;

  const sep = "═".repeat(28);
  const gameList = games.length > 0
    ? games.map((g) => `• ${g}`).join("\n")
    : "No games configured. Use `/setup games` to add games.";

  const embed = new EmbedBuilder()
    .setTitle("📋 Helper Applications")
    .setDescription(
      `Want to become a helper? Click the button below to apply!\n\n**Available Games:**\n${sep}\n${gameList}\n${sep}\n\nYou will be asked a few questions about your experience. Applications are reviewed by staff and you will be notified of the outcome.`
    )
    .setColor(0xe91e8c)
    .setFooter({ text: "HELPER APPLICATIONS" });

  if (imageUrl) embed.setImage(imageUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("app_apply")
      .setLabel("Apply to be a Helper")
      .setStyle(ButtonStyle.Success)
      .setEmoji("📋"),
    new ButtonBuilder()
      .setCustomId("app_img_guide")
      .setLabel("How to send images in your application")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🖼️"),
  );

  const target = (interaction.options.getChannel("channel") as TextChannel | null)
    ?? interaction.channel as TextChannel;

  await target.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ Application panel posted in ${target}.`, ephemeral: true });
}
