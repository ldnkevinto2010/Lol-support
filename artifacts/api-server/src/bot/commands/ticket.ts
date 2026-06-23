import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  TextChannel,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig";
import { Ticket } from "../models/Ticket";
import { UserMessageCount } from "../models/UserMessageCount";

export const data = new SlashCommandBuilder()
  .setName("ticket")
  .setDescription("Ticket system commands")
  .addSubcommand((sub) =>
    sub
      .setName("open")
      .setDescription("Open a new support ticket")
  )
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
      .setName("add")
      .setDescription("Add a user to this ticket")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to add").setRequired(true)
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

  // ─── /ticket open — show modal ───
  if (sub === "open") {
    if (!config?.ticketCategoryId) {
      await interaction.reply({
        content: "❌ Tickets are not configured yet. Ask an admin to run `/setup ticket-category`.",
        ephemeral: true,
      });
      return;
    }

    // Check message requirement
    if (config.minMessagesRequired > 0) {
      const msgCount = await UserMessageCount.findOne({
        guildId: interaction.guildId,
        userId: interaction.user.id,
      });
      const count = msgCount?.count ?? 0;
      if (count < config.minMessagesRequired) {
        await interaction.reply({
          content: `❌ You need at least **${config.minMessagesRequired}** messages in this server to open a ticket. You currently have **${count}**.`,
          ephemeral: true,
        });
        return;
      }
    }

    // Check for existing open ticket
    const existing = await Ticket.findOne({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      status: { $in: ["open", "claimed"] },
    });
    if (existing) {
      await interaction.reply({
        content: `❌ You already have an open ticket: <#${existing.channelId}>`,
        ephemeral: true,
      });
      return;
    }

    // Show the ticket creation modal
    const modal = new ModalBuilder()
      .setCustomId("ticket_open_modal")
      .setTitle("Open a Ticket");

    const gameInput = new TextInputBuilder()
      .setCustomId("ticket_game")
      .setLabel("Game")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. Blox Fruits, UTD, AUT...")
      .setRequired(true)
      .setMaxLength(100);

    const requestInput = new TextInputBuilder()
      .setCustomId("ticket_request")
      .setLabel("Request")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Describe what you need help with...")
      .setRequired(true)
      .setMaxLength(500);

    const privateServerInput = new TextInputBuilder()
      .setCustomId("ticket_private_server")
      .setLabel("Do you have a Private Server? (Yes / No)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Yes or No")
      .setRequired(true)
      .setMaxLength(20);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(gameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(requestInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(privateServerInput),
    );

    await interaction.showModal(modal);
    return;
  }

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



  // ─── /ticket add ───
  if (sub === "add") {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({ content: "❌ This is not an active ticket channel.", ephemeral: true });
      return;
    }

    const isStaff = [...(config?.staffRoles ?? []), ...(config?.helperRoles ?? [])].some(
      (id) => (interaction.member as any)?.roles?.cache?.has(id)
    );
    const isAdmin = (interaction.member as any)?.permissions?.has(PermissionFlagsBits.Administrator);
    const isOwner = ticket.userId === interaction.user.id;

    if (!isStaff && !isAdmin && !isOwner) {
      await interaction.reply({ content: "❌ You don't have permission to add users to this ticket.", ephemeral: true });
      return;
    }

    const user = interaction.options.getUser("user", true);
    const channel = interaction.channel as TextChannel;
    await channel.permissionOverwrites.edit(user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    await interaction.reply({ content: `✅ Added ${user} to this ticket.` });
    return;
  }
}
