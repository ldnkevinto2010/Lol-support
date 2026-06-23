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
  AttachmentBuilder,
  ChannelType,
  OverwriteType,
  OverwriteResolvable,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Collection,
  Message,
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


function ticketButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim Ticket")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("✋"),
    new ButtonBuilder()
      .setCustomId("ticket_unclaim")
      .setLabel("Unclaim Ticket")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔓"),
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
    .setLabel("Can you join a private server? (Yes / No)")
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
  config: IGuildConfig | null,
  memberRoleIds: string[] = []
): Promise<string | null> {
  if (!config?.ticketCategoryId) {
    return "❌ Tickets are not configured yet. Ask an admin to run `/setup ticket-category`.";
  }
  const hasBypass = (config.bypassRoles ?? []).some((r) => memberRoleIds.includes(r));
  if (!hasBypass && config.minMessagesRequired > 0) {
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

// ─── Transcript generator ───
export async function generateTranscript(channel: TextChannel): Promise<AttachmentBuilder> {
  const lines: string[] = [];
  lines.push(`═══════════════════════════════════════════════════`);
  lines.push(`  TICKET TRANSCRIPT — #${channel.name}`);
  lines.push(`  Generated: ${new Date().toUTCString()}`);
  lines.push(`═══════════════════════════════════════════════════`);
  lines.push("");

  let lastId: string | undefined;
  const allMessages: Message[] = [];

  // Paginate through all messages (100 per fetch)
  while (true) {
    const fetched: Collection<string, Message> = await channel.messages.fetch({
      limit: 100,
      ...(lastId ? { before: lastId } : {}),
    });
    if (fetched.size === 0) break;
    allMessages.push(...fetched.values());
    lastId = fetched.last()?.id;
    if (fetched.size < 100) break;
  }

  // Oldest first
  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  for (const msg of allMessages) {
    const ts = msg.createdAt.toUTCString();
    const tag = msg.author.tag;
    const bot = msg.author.bot ? " [BOT]" : "";
    const content = msg.content || (msg.embeds.length > 0 ? "[embed]" : "[no content]");
    lines.push(`[${ts}] ${tag}${bot}: ${content}`);
    if (msg.attachments.size > 0) {
      for (const att of msg.attachments.values()) {
        lines.push(`  📎 Attachment: ${att.url}`);
      }
    }
  }

  lines.push("");
  lines.push(`═══════════════════════════════════════════════════`);
  lines.push(`  END OF TRANSCRIPT — ${allMessages.length} messages`);
  lines.push(`═══════════════════════════════════════════════════`);

  const buffer = Buffer.from(lines.join("\n"), "utf-8");
  return new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` });
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
  reason: string,
  ticketChannel?: TextChannel
): Promise<void> {
  if (!guildConfig?.ticketLogChannelId) return;
  const logChannel = guild.channels.cache.get(guildConfig.ticketLogChannelId) as TextChannel | undefined;
  if (!logChannel) return;

  const logEmbed = new EmbedBuilder()
    .setTitle("Ticket Closed")
    .setColor(0xed4245)
    .addFields(
      { name: "Ticket", value: `#${String(ticket.ticketNumber).padStart(4, "0")} — #${ticketChannel?.name ?? ticket.channelId}`, inline: true },
      { name: "Opened By", value: `<@${ticket.userId}>`, inline: true },
      { name: "Closed By", value: `${closedBy}`, inline: true },
      { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true },
      { name: "Reason", value: reason, inline: false },
    )
    .setTimestamp();

  if (ticketChannel) {
    try {
      const attachment = await generateTranscript(ticketChannel);
      await logChannel.send({ embeds: [logEmbed], files: [attachment] });
    } catch {
      await logChannel.send({ embeds: [logEmbed] });
    }
  } else {
    await logChannel.send({ embeds: [logEmbed] });
  }
}

// ─── Shared close logic ───
export async function handleTicketClose(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  config: IGuildConfig | null,
  reason = "No reason provided"
): Promise<void> {
  const safeReply = async (content: string) => {
    const payload = { content, ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  };

  const ticket = await Ticket.findOne({ channelId: interaction.channelId });
  if (!ticket || ticket.status === "closed") {
    await safeReply("❌ This is not an active ticket channel.");
    return;
  }

  const isStaff = [...(config?.staffRoles ?? []), ...(config?.helperRoles ?? [])].some(
    (id) => (interaction.member as any)?.roles?.cache?.has(id)
  );
  const isOwner = ticket.userId === interaction.user.id;
  const isAdmin = (interaction.member as any)?.permissions?.has(PermissionFlagsBits.Administrator);

  if (!isStaff && !isOwner && !isAdmin) {
    await safeReply("❌ You don't have permission to close this ticket.");
    return;
  }

  ticket.status = "closed";
  ticket.closedAt = new Date();
  await ticket.save();

  const ticketChannel = interaction.channel as TextChannel | undefined;

  await logTicketClose(config, interaction.guild!, ticket, interaction.user, reason, ticketChannel);

  if (ticket.claimedBy && ticket.claimedBy !== ticket.userId) {
    await sendVouchPrompt(interaction.channel as TextChannel, ticket.userId, ticket.claimedBy);
  }

  // Ping the ticket owner so they see it's closing, then show countdown
  if (ticketChannel) {
    await ticketChannel.send({ content: `<@${ticket.userId}>` });
    await ticketChannel.send({
      content: `🔒 This ticket will be closed in **10 seconds**...`,
    });
  }

  setTimeout(async () => {
    try {
      const ch = interaction.guild!.channels.cache.get(ticket.channelId) as TextChannel | undefined;
      if (ch) await ch.delete("Ticket closed");
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
    const memberRoles = (interaction.member as any)?.roles?.cache?.map((r: any) => r.id) ?? [];
    const error = await checkTicketPrerequisites(guildId, interaction.user.id, config, memberRoles);
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

  if (customId === "ticket_claim") {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({ content: "❌ This is not an active ticket channel.", ephemeral: true });
      return;
    }
    if (ticket.claimedBy) {
      await interaction.reply({ content: `❌ Already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
      return;
    }

    const isStaff = [...(config?.staffRoles ?? []), ...(config?.helperRoles ?? [])].some(
      (id) => (interaction.member as any)?.roles?.cache?.has(id)
    );
    const isAdmin = (interaction.member as any)?.permissions?.has(BigInt(8));
    if (!isStaff && !isAdmin) {
      await interaction.reply({ content: "❌ Only staff or helpers can claim tickets.", ephemeral: true });
      return;
    }

    ticket.claimedBy = interaction.user.id;
    ticket.status = "claimed";
    await ticket.save();

    // Lock the channel: only ticket creator, claimer, and staff roles can see/type
    const channel = interaction.channel as TextChannel;
    const overwrites: OverwriteResolvable[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
        type: OverwriteType.Role,
      },
      {
        id: ticket.userId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
        type: OverwriteType.Member,
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ManageMessages,
        ],
        type: OverwriteType.Member,
      },
    ];
    for (const staffRoleId of config?.staffRoles ?? []) {
      overwrites.push({
        id: staffRoleId,
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
    await channel.permissionOverwrites.set(overwrites);

    const embed = new EmbedBuilder()
      .setDescription(`✋ ${interaction.user} has claimed this ticket.\n🔒 This ticket is now private between ${interaction.user}, <@${ticket.userId}>, and staff.`)
      .setColor(0x5865f2);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (customId === "ticket_unclaim") {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({ content: "❌ This is not an active ticket channel.", ephemeral: true });
      return;
    }
    if (!ticket.claimedBy) {
      await interaction.reply({ content: "❌ This ticket hasn't been claimed.", ephemeral: true });
      return;
    }

    const isStaff = [...(config?.staffRoles ?? []), ...(config?.helperRoles ?? [])].some(
      (id) => (interaction.member as any)?.roles?.cache?.has(id)
    );
    const isAdmin = (interaction.member as any)?.permissions?.has(BigInt(8));
    const isClaimer = ticket.claimedBy === interaction.user.id;

    if (!isStaff && !isAdmin && !isClaimer) {
      await interaction.reply({ content: "❌ Only the claimer or staff can unclaim this ticket.", ephemeral: true });
      return;
    }

    ticket.claimedBy = null;
    ticket.status = "open";
    await ticket.save();

    // Restore original open-ticket permissions — staff and helpers only
    const channel = interaction.channel as TextChannel;
    const overwrites: OverwriteResolvable[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
        type: OverwriteType.Role,
      },
    ];
    for (const staffRoleId of config?.staffRoles ?? []) {
      overwrites.push({
        id: staffRoleId,
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
    for (const helperRoleId of config?.helperRoles ?? []) {
      overwrites.push({
        id: helperRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        type: OverwriteType.Role,
      });
    }
    await channel.permissionOverwrites.set(overwrites);

    const embed = new EmbedBuilder()
      .setDescription(`🔓 ${interaction.user} unclaimed this ticket — it is now open to all staff again.`)
      .setColor(0x99aab5);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (customId === "ticket_close") {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({ content: "❌ This is not an active ticket channel.", ephemeral: true });
      return;
    }
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close_confirm")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒"),
      new ButtonBuilder()
        .setCustomId("ticket_close_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({
      content: "Are you sure you want to close this ticket?",
      components: [confirmRow],
      ephemeral: true,
    });
    return;
  }

  if (customId === "ticket_close_confirm") {
    await interaction.update({ content: "Closing ticket...", components: [] });
    await handleTicketClose(interaction, config);
    return;
  }

  if (customId === "ticket_close_cancel") {
    await interaction.update({ content: "❌ Cancelled.", components: [] });
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

    const reasonInput = new TextInputBuilder()
      .setCustomId("vouch_reason")
      .setLabel("Reason (optional)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Describe your experience...")
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
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

  if (customId === "setup_remove_helper_role") {
    const roleId = interaction.values[0]!;
    const config = await GuildConfig.findOne({ guildId });
    if (!config) {
      await interaction.reply({ content: "❌ No configuration found.", ephemeral: true });
      return;
    }
    const before = config.helperRoles.length;
    config.helperRoles = config.helperRoles.filter((id) => id !== roleId);
    if (config.helperRoles.length === before) {
      await interaction.reply({ content: "❌ That role wasn't in the helper list.", ephemeral: true });
      return;
    }
    await config.save();
    await interaction.update({ content: `✅ Removed <@&${roleId}> from helper roles.`, components: [] });
    return;
  }

  if (customId === "setup_remove_staff_role") {
    const roleId = interaction.values[0]!;
    const config = await GuildConfig.findOne({ guildId });
    if (!config) {
      await interaction.reply({ content: "❌ No configuration found.", ephemeral: true });
      return;
    }
    const before = config.staffRoles.length;
    config.staffRoles = config.staffRoles.filter((id) => id !== roleId);
    if (config.staffRoles.length === before) {
      await interaction.reply({ content: "❌ That role wasn't in the staff list.", ephemeral: true });
      return;
    }
    await config.save();
    await interaction.update({ content: `✅ Removed <@&${roleId}> from staff roles.`, components: [] });
    return;
  }

  if (customId === "setup_remove_bypass_role") {
    const roleId = interaction.values[0]!;
    const config = await GuildConfig.findOne({ guildId });
    if (!config) {
      await interaction.reply({ content: "❌ No configuration found.", ephemeral: true });
      return;
    }
    const before = config.bypassRoles.length;
    config.bypassRoles = config.bypassRoles.filter((id) => id !== roleId);
    if (config.bypassRoles.length === before) {
      await interaction.reply({ content: "❌ That role wasn't in the bypass list.", ephemeral: true });
      return;
    }
    await config.save();
    await interaction.update({ content: `✅ Removed <@&${roleId}> from bypass roles.`, components: [] });
    return;
  }

  if (customId === "setup_remove_game_role") {
    const gameName = interaction.values[0]!;
    const config = await GuildConfig.findOne({ guildId });
    if (!config) {
      await interaction.reply({ content: "❌ No configuration found.", ephemeral: true });
      return;
    }
    const before = config.gameRoles.length;
    config.gameRoles = config.gameRoles.filter(
      (gr) => gr.game.toLowerCase() !== gameName.toLowerCase()
    );
    if (config.gameRoles.length === before) {
      await interaction.reply({ content: `❌ No role mapping found for **${gameName}**.`, ephemeral: true });
      return;
    }
    await config.save();
    await interaction.update({
      content: `✅ Removed the role mapping for **${gameName}**.`,
      components: [],
    });
    return;
  }

  if (customId === "setup_remove_game_mapping") {
    const gameName = interaction.values[0]!;
    const config = await GuildConfig.findOne({ guildId });
    if (!config) {
      await interaction.reply({ content: "❌ No configuration found.", ephemeral: true });
      return;
    }
    const before = config.gameCategories.length;
    config.gameCategories = config.gameCategories.filter(
      (gc) => gc.game.toLowerCase() !== gameName.toLowerCase()
    );
    if (config.gameCategories.length === before) {
      await interaction.reply({ content: `❌ No mapping found for **${gameName}**.`, ephemeral: true });
      return;
    }
    await config.save();
    await interaction.update({
      content: `✅ Removed the category mapping for **${gameName}**.`,
      components: [],
    });
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

    // Permission overwrites — only staff and helpers can see tickets
    const overwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
        type: OverwriteType.Role,
      },
    ];

    for (const staffRoleId of config.staffRoles ?? []) {
      overwrites.push({
        id: staffRoleId,
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

    // Helper roles can see open tickets but are locked out once claimed
    for (const helperRoleId of config.helperRoles ?? []) {
      overwrites.push({
        id: helperRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        type: OverwriteType.Role,
      });
    }

    // Resolve category: per-game mapping takes priority over the default
    const gameCategory = config.gameCategories?.find(
      (gc) => gc.game.toLowerCase() === game.toLowerCase()
    );
    const categoryId = gameCategory?.categoryId ?? config.ticketCategoryId;

    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
    const channel = await guild.channels.create({
      name: `ticket-${safeName}`,
      type: ChannelType.GuildText,
      parent: categoryId,
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

    // Reset message count so user must re-earn messages before opening another ticket
    await UserMessageCount.findOneAndUpdate(
      { guildId, userId: interaction.user.id },
      { $set: { count: 0 } }
    );

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

    // Game-specific role takes priority over the default ping role
    const gameRole = config.gameRoles?.find(
      (gr) => gr.game.toLowerCase() === game.toLowerCase()
    );
    const pingRoleId = gameRole?.roleId ?? config.supportRoleId;
    const mentionContent = pingRoleId
      ? `<@&${pingRoleId}> ${interaction.user}`
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
    const reason = interaction.fields.getTextInputValue("vouch_reason") ?? "";

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
      reason,
      ticketId: ticket?._id?.toString() ?? null,
    });

    const config = await GuildConfig.findOne({ guildId });
    if (config?.vouchChannelId) {
      const vouchChannel = guild.channels.cache.get(config.vouchChannelId) as TextChannel | undefined;
      if (vouchChannel) {
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        const total = await Vouch.countDocuments({ guildId, toUserId: targetUserId });

        const embed = new EmbedBuilder()
          .setTitle("New Vouch")
          .setColor(0xfee75c)
          .addFields(
            { name: "For", value: targetUser ? `${targetUser} (${targetUser.tag})` : `<@${targetUserId}>`, inline: true },
            { name: "From", value: `${interaction.user}`, inline: true },
            { name: "Total Vouches", value: `${total}`, inline: true },
          )
          .setTimestamp();

        if (reason) embed.addFields({ name: "Reason", value: reason });
        if (targetUser) embed.setThumbnail(targetUser.displayAvatarURL());

        await vouchChannel.send({ embeds: [embed] });
      }
    }

    await interaction.editReply({ content: `✅ Thanks! Your vouch has been recorded.` });
    return;
  }
}
