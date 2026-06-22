import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  EmbedBuilder,
  TextChannel,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { GuildConfig, IGuildConfig } from "./models/GuildConfig";
import { Ticket } from "./models/Ticket";
import { Vouch } from "./models/Vouch";
import { UserMessageCount } from "./models/UserMessageCount";

const DEFAULT_GAMES = [
  "Universal Tower Defense",
  "Sailor Piece",
  "Anime Rangers X",
  "Anime Apocalypse",
  "Anime Squadron",
];

function starsDisplay(rating: number): string {
  return "⭐".repeat(rating) + "☆".repeat(5 - rating);
}

function ticketButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("✋"),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔒"),
  );
}

function buildTicketModal(game: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_open_modal_${encodeURIComponent(game)}`)
    .setTitle("Open a Ticket");

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
    new ActionRowBuilder<TextInputBuilder>().addComponents(requestInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(privateServerInput),
  );

  return modal;
}

async function checkTicketPrerequisites(
  guildId: string,
  userId: string,
  config: IGuildConfig | null
): Promise<string | null> {
  if (!config?.ticketCategoryId) {
    return "❌ Tickets are not configured yet. Ask an admin to run `/setup ticket-category`.";
  }
  if (config.minMessagesRequired > 0) {
    const msgDoc = await UserMessageCount.findOne({ guildId, userId });
    const count = msgDoc?.count ?? 0;
    if (count < config.minMessagesRequired) {
      return `❌ You need at least **${config.minMessagesRequired}** messages to open a ticket. You have **${count}**.`;
    }
  }
  const existing = await Ticket.findOne({
    guildId,
    userId,
    status: { $in: ["open", "claimed"] },
  });
  if (existing) {
    return `❌ You already have an open ticket: <#${existing.channelId}>`;
  }
  return null;
}

async function sendVouchPrompt(
  channel: TextChannel,
  ticketUserId: string,
  claimedById: string
): Promise<void> {
  const ticketUser = await channel.guild.members.fetch(ticketUserId).catch(() => null);
  if (!ticketUser) return;

  const vouchRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`vouch_start_${claimedById}`)
      .setLabel("Leave a Vouch")
      .setStyle(ButtonStyle.Success)
      .setEmoji("⭐")
  );
  const vouchEmbed = new EmbedBuilder()
    .setTitle("How was your experience?")
    .setDescription(
      `${ticketUser}, would you like to leave a vouch for <@${claimedById}> who helped you?`
    )
    .setColor(0xfee75c);

  await channel.send({ embeds: [vouchEmbed], components: [vouchRow] });
}

async function logTicketClose(
  guildConfig: IGuildConfig | null,
  guild: import("discord.js").Guild,
  ticket: InstanceType<typeof Ticket>,
  closedBy: import("discord.js").User,
  reason: string
): Promise<void> {
  if (!guildConfig?.ticketLogChannelId) return;
  const logChannel = guild.channels.cache.get(guildConfig.ticketLogChannelId) as TextChannel | undefined;
  if (!logChannel) return;

  const logEmbed = new EmbedBuilder()
    .setTitle("Ticket Closed")
    .setColor(0xed4245)
    .addFields(
      { name: "Ticket", value: `#${String(ticket.ticketNumber).padStart(4, "0")} — <#${ticket.channelId}>`, inline: true },
      { name: "Opened By", value: `<@${ticket.userId}>`, inline: true },
      { name: "Closed By", value: `${closedBy}`, inline: true },
      { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true },
      { name: "Reason", value: reason, inline: false },
    )
    .setTimestamp();
  await logChannel.send({ embeds: [logEmbed] });
}

// ─── Shared close logic ───
export async function handleTicketClose(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  config: IGuildConfig | null,
  reason = "No reason provided"
): Promise<void> {
  const ticket = await Ticket.findOne({ channelId: interaction.channelId });
  if (!ticket || ticket.status === "closed") {
    await interaction.reply({ content: "❌ This is not an active ticket channel.", ephemeral: true });
    return;
  }

  const isStaff = config?.supportRoleId
    ? (interaction.member as any)?.roles?.cache?.has(config.supportRoleId)
    : false;
  const isOwner = ticket.userId === interaction.user.id;
  const isAdmin = (interaction.member as any)?.permissions?.has(PermissionFlagsBits.Administrator);

  if (!isStaff && !isOwner && !isAdmin) {
    await interaction.reply({ content: "❌ You don't have permission to close this ticket.", ephemeral: true });
    return;
  }

  ticket.status = "closed";
  ticket.closedAt = new Date();
  await ticket.save();

  const closeEmbed = new EmbedBuilder()
    .setTitle("🔒 Ticket Closed")
    .setColor(0xed4245)
    .addFields(
      { name: "Closed By", value: `${interaction.user}`, inline: true },
      { name: "Reason", value: reason, inline: true },
    )
    .setTimestamp();

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ embeds: [closeEmbed] });
  } else {
    await interaction.reply({ embeds: [closeEmbed] });
  }

  await logTicketClose(config, interaction.guild!, ticket, interaction.user, reason);

  if (ticket.claimedBy && ticket.claimedBy !== ticket.userId) {
    await sendVouchPrompt(interaction.channel as TextChannel, ticket.userId, ticket.claimedBy);
  }

  setTimeout(async () => {
    try {
      const ch = interaction.guild!.channels.cache.get(ticket.channelId) as TextChannel | undefined;
      if (ch) await ch.permissionOverwrites.edit(ticket.userId, { ViewChannel: false });
    } catch (_) {}
  }, 10000);
}

// ─── Button handler ───
export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, guildId, guild } = interaction;
  if (!guildId || !guild) return;

  const config = await GuildConfig.findOne({ guildId });

  // Panel "Create Ticket" button → show game select dropdown
  if (customId === "ticket_open_panel") {
    const error = await checkTicketPrerequisites(guildId, interaction.user.id, config);
    if (error) {
      await interaction.reply({ content: error, ephemeral: true });
      return;
    }

    const games = (config?.supportedGames?.length ?? 0) > 0
      ? config!.supportedGames
      : DEFAULT_GAMES;

    // Show game select dropdown
    const select = new StringSelectMenuBuilder()
      .setCustomId("ticket_game_select")
      .setPlaceholder("Select the game your ticket is for...")
      .addOptions(
        games.slice(0, 25).map((g) =>
          new StringSelectMenuOptionBuilder().setLabel(g).setValue(g)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({
      content: "**Select the game your ticket is for:**",
      components: [row],
      ephemeral: true,
    });
    return;
  }

  if (customId === "ticket_close") {
    await handleTicketClose(interaction, config);
    return;
  }

  if (customId === "ticket_claim") {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({ content: "❌ This ticket is not active.", ephemeral: true });
      return;
    }
    if (ticket.claimedBy) {
      await interaction.reply({ content: `❌ Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
      return;
    }

    const isStaff = config?.supportRoleId
      ? (interaction.member as any)?.roles?.cache?.has(config.supportRoleId)
      : false;
    const isAdmin = (interaction.member as any)?.permissions?.has(BigInt(8));

    if (!isStaff && !isAdmin) {
      await interaction.reply({ content: "❌ Only support staff can claim tickets.", ephemeral: true });
      return;
    }

    ticket.claimedBy = interaction.user.id;
    ticket.status = "claimed";
    await ticket.save();

    const embed = new EmbedBuilder()
      .setDescription(`✋ ${interaction.user} has claimed this ticket and will be assisting you.`)
      .setColor(0x5865f2);

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (customId.startsWith("vouch_start_")) {
    const targetUserId = customId.replace("vouch_start_", "");

    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (ticket && ticket.userId !== interaction.user.id) {
      await interaction.reply({ content: "❌ Only the ticket creator can leave a vouch.", ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`vouch_modal_${targetUserId}`)
      .setTitle("Leave a Vouch");

    const ratingInput = new TextInputBuilder()
      .setCustomId("vouch_rating")
      .setLabel("Rating (1–5 stars)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Enter a number from 1 to 5")
      .setMinLength(1)
      .setMaxLength(1)
      .setRequired(true);

    const commentInput = new TextInputBuilder()
      .setCustomId("vouch_comment")
      .setLabel("Comment (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Describe your experience...")
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(ratingInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)
    );

    await interaction.showModal(modal);
    return;
  }
}

// ─── Select menu handler (game selection) ───
export async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const { customId, guildId } = interaction;
  if (!guildId) return;

  if (customId === "ticket_game_select") {
    const game = interaction.values[0]!;
    const modal = buildTicketModal(game);
    await interaction.showModal(modal);
    return;
  }
}

// ─── Modal handler ───
export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId, guildId, guild } = interaction;
  if (!guildId || !guild) return;

  // ─── Ticket open modal ───
  if (customId.startsWith("ticket_open_modal_")) {
    const encodedGame = customId.replace("ticket_open_modal_", "");
    const request = interaction.fields.getTextInputValue("ticket_request");
    const privateServer = interaction.fields.getTextInputValue("ticket_private_server");

    const game = encodedGame ? decodeURIComponent(encodedGame) : "Unknown";

    await interaction.deferReply({ ephemeral: true });

    const config = await GuildConfig.findOne({ guildId });
    if (!config?.ticketCategoryId) {
      await interaction.editReply({ content: "❌ Ticket category is not configured." });
      return;
    }

    // Increment ticket counter
    const updatedConfig = await GuildConfig.findOneAndUpdate(
      { guildId },
      { $inc: { ticketCounter: 1 } },
      { new: true }
    );
    const ticketNum = updatedConfig?.ticketCounter ?? 1;

    // Permission overwrites
    const overwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
        type: OverwriteType.Role,
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
        type: OverwriteType.Member,
      },
    ];

    if (config.supportRoleId) {
      overwrites.push({
        id: config.supportRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages,
        ],
        type: OverwriteType.Role,
      });
    }

    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
    const channel = await guild.channels.create({
      name: `ticket-${safeName}`,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      topic: `ticket_user:${interaction.user.id} | game:${game}`,
      permissionOverwrites: overwrites,
    });

    await Ticket.create({
      guildId,
      channelId: channel.id,
      ticketNumber: ticketNum,
      userId: interaction.user.id,
      topic: `${game} — ${request}`,
    });

    const embed = new EmbedBuilder()
      .setTitle("🎫 New Ticket Created")
      .setColor(0xed4245)
      .addFields(
        { name: "User", value: `${interaction.user}`, inline: false },
        { name: "Game", value: game, inline: false },
        { name: "Request", value: request, inline: false },
        { name: "Private Servers", value: privateServer, inline: false },
      )
      .setTimestamp();

    const mentionContent = config.supportRoleId
      ? `<@&${config.supportRoleId}> ${interaction.user}`
      : `${interaction.user}`;

    await channel.send({
      content: mentionContent,
      embeds: [embed],
      components: [ticketButtons()],
    });

    if (config.ticketLogChannelId) {
      const logChannel = guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle("Ticket Opened")
          .setColor(0x57f287)
          .addFields(
            { name: "Ticket", value: `#${String(ticketNum).padStart(4, "0")} — ${channel}`, inline: true },
            { name: "Opened By", value: `${interaction.user} (${interaction.user.id})`, inline: true },
            { name: "Game", value: game, inline: true },
            { name: "Request", value: request, inline: false },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    await interaction.editReply({ content: `✅ Your ticket has been created: ${channel}` });
    return;
  }

  // ─── Vouch modal ───
  if (customId.startsWith("vouch_modal_")) {
    const targetUserId = customId.replace("vouch_modal_", "");
    const ratingStr = interaction.fields.getTextInputValue("vouch_rating");
    const comment = interaction.fields.getTextInputValue("vouch_comment") ?? "";

    const rating = parseInt(ratingStr, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      await interaction.reply({ content: "❌ Rating must be a number between 1 and 5.", ephemeral: true });
      return;
    }
    if (targetUserId === interaction.user.id) {
      await interaction.reply({ content: "❌ You cannot vouch yourself.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    await Vouch.create({
      guildId,
      fromUserId: interaction.user.id,
      toUserId: targetUserId,
      rating,
      comment,
      ticketId: ticket?._id?.toString() ?? null,
    });

    const config = await GuildConfig.findOne({ guildId });
    if (config?.vouchChannelId) {
      const vouchChannel = guild.channels.cache.get(config.vouchChannelId) as TextChannel | undefined;
      if (vouchChannel) {
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        const allVouches = await Vouch.find({ guildId, toUserId: targetUserId });
        const avg = allVouches.reduce((sum, v) => sum + v.rating, 0) / allVouches.length;

        const embed = new EmbedBuilder()
          .setTitle("New Vouch")
          .setColor(0xfee75c)
          .addFields(
            { name: "For", value: targetUser ? `${targetUser} (${targetUser.tag})` : `<@${targetUserId}>`, inline: true },
            { name: "From", value: `${interaction.user}`, inline: true },
            { name: "Rating", value: starsDisplay(rating), inline: true },
            { name: "Total Vouches", value: `${allVouches.length}`, inline: true },
            { name: "Average Rating", value: `${avg.toFixed(2)} / 5.00`, inline: true },
          )
          .setTimestamp();

        if (comment) embed.addFields({ name: "Comment", value: comment });
        if (targetUser) embed.setThumbnail(targetUser.displayAvatarURL());

        await vouchChannel.send({ embeds: [embed] });
      }
    }

    await interaction.editReply({ content: `✅ Thanks! Your vouch (${starsDisplay(rating)}) has been recorded.` });
    return;
  }
}
