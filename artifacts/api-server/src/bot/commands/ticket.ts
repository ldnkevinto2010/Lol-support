import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  TextChannel,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig";
import { Ticket } from "../models/Ticket";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket system commands")
  .addSubcommand((sub) =>
    sub
      .setName("close")
      .setDescription("Close this ticket")
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for closing")
          .setRequired(false)
          .setMaxLength(200)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("transcript")
      .setDescription("Generate and send a transcript of this ticket (staff/admin only)")
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Post the ticket panel in this channel (admin only)")
      .addStringOption((opt) =>
        opt
          .setName("title")
          .setDescription("Panel embed title")
          .setRequired(false)
          .setMaxLength(100)
      )
      .addStringOption((opt) =>
        opt
          .setName("description")
          .setDescription("Panel embed description")
          .setRequired(false)
          .setMaxLength(500)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const config = await GuildConfig.findOne({ guildId: interaction.guildId });

  // ─── /ticket transcript ───
  if (sub === "transcript") {
    const isStaff = (config?.staffRoles ?? []).some(
      (id) => (interaction.member as any)?.roles?.cache?.has(id)
    );
    const isAdmin = (interaction.member as any)?.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isStaff && !isAdmin) {
      await interaction.reply({ content: "❌ Only support staff or admins can generate transcripts.", ephemeral: true });
      return;
    }

    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket) {
      await interaction.reply({ content: "❌ This is not a ticket channel.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const { generateTranscript } = await import("../interactions");
    const attachment = await generateTranscript(interaction.channel as TextChannel);

    await interaction.editReply({
      content: "📄 Here is the transcript for this ticket:",
      files: [attachment],
    });
    return;
  }

  // ─── /ticket panel ───
  if (sub === "panel") {
    const isAdmin = (interaction.member as any)?.permissions?.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) {
      await interaction.reply({ content: "❌ Only administrators can post the ticket panel.", ephemeral: true });
      return;
    }

    const title = interaction.options.getString("title") ?? "🎫 Carry Requests";
    const description =
      interaction.options.getString("description") ??
      "Welcome to our carry service!\n\nPlease note that we will only help you complete **5 runs for free** for each ticket you make.\nClick the button below to create a carry request ticket and get started!";

    const games = config?.supportedGames ?? [];

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x5865f2)
      .setFooter({ text: "CARRY TICKETS" });

    if (games.length > 0) {
      embed.addFields({
        name: "Supported Games:",
        value: "━━━━━━━━━━━━━━━━━━━━━━━━\n" +
          games.map((g) => `• ${g}`).join("\n") +
          "\n━━━━━━━━━━━━━━━━━━━━━━━━",
      });
    }

    if (config?.panelImageUrl) {
      embed.setImage(config.panelImageUrl);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_open_panel")
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ content: "✅ Panel posted!", ephemeral: true });
    await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
    return;
  }

  // ─── /ticket close ───
  if (sub === "close") {
    const { handleTicketClose } = await import("../interactions");
    await handleTicketClose(interaction, config);
    return;
  }



}
