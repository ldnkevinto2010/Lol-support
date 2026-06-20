import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  OverwriteType,
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
      .addStringOption((opt) =>
        opt
          .setName("topic")
          .setDescription("What do you need help with?")
          .setRequired(false)
          .setMaxLength(200)
      )
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
      .setName("claim")
      .setDescription("Claim this ticket (staff only)")
  )
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add a user to this ticket")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("User to add").setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const config = await GuildConfig.findOne({ guildId: interaction.guildId });

  if (sub === "open") {
    if (!config?.ticketCategoryId) {
      await interaction.reply({ content: "❌ Tickets are not configured yet. Ask an admin to run `/setup ticket-category`.", ephemeral: true });
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

    // Check if user already has an open ticket
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

    await interaction.deferReply({ ephemeral: true });

    const topic = interaction.options.getString("topic") ?? "No topic provided";

    // Increment ticket counter
    const updatedConfig = await GuildConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      { $inc: { ticketCounter: 1 } },
      { new: true }
    );
    const ticketNum = updatedConfig?.ticketCounter ?? 1;

    // Build permission overwrites
    const overwrites: any[] = [
      {
        id: interaction.guild.roles.everyone.id,
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

    const channel = await interaction.guild.channels.create({
      name: `ticket-${String(ticketNum).padStart(4, "0")}`,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      topic: `Ticket by ${interaction.user.tag} | ${topic}`,
      permissionOverwrites: overwrites,
    });

    // Save ticket to DB
    await Ticket.create({
      guildId: interaction.guildId,
      channelId: channel.id,
      ticketNumber: ticketNum,
      userId: interaction.user.id,
      topic,
    });

    // Send welcome embed
    const embed = new EmbedBuilder()
      .setTitle(`Ticket #${String(ticketNum).padStart(4, "0")}`)
      .setDescription(
        `Welcome ${interaction.user}! Support will be with you shortly.\n\n**Topic:** ${topic}`
      )
      .setColor(0x57f287)
      .setFooter({ text: "Use the button below or /ticket close to close this ticket." })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_close")
        .setLabel("Close Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒"),
      new ButtonBuilder()
        .setCustomId("ticket_claim")
        .setLabel("Claim Ticket")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("✋")
    );

    await channel.send({
      content: config.supportRoleId ? `<@&${config.supportRoleId}> ${interaction.user}` : `${interaction.user}`,
      embeds: [embed],
      components: [row],
    });

    // Log to log channel
    if (config.ticketLogChannelId) {
      const logChannel = interaction.guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle("Ticket Opened")
          .setColor(0x57f287)
          .addFields(
            { name: "Ticket", value: `#${String(ticketNum).padStart(4, "0")} — ${channel}`, inline: true },
            { name: "Opened By", value: `${interaction.user} (${interaction.user.id})`, inline: true },
            { name: "Topic", value: topic, inline: false },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    await interaction.editReply({ content: `✅ Your ticket has been created: ${channel}` });

  } else if (sub === "close") {
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

    const reason = interaction.options.getString("reason") ?? "No reason provided";
    await interaction.deferReply();

    ticket.status = "closed";
    ticket.closedAt = new Date();
    await ticket.save();

    // Send closing embed
    const closeEmbed = new EmbedBuilder()
      .setTitle("Ticket Closed")
      .setColor(0xed4245)
      .addFields(
        { name: "Closed By", value: `${interaction.user}`, inline: true },
        { name: "Reason", value: reason, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [closeEmbed] });

    // Log closure
    if (config?.ticketLogChannelId) {
      const logChannel = interaction.guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle("Ticket Closed")
          .setColor(0xed4245)
          .addFields(
            { name: "Ticket", value: `#${String(ticket.ticketNumber).padStart(4, "0")}`, inline: true },
            { name: "Opened By", value: `<@${ticket.userId}>`, inline: true },
            { name: "Closed By", value: `${interaction.user}`, inline: true },
            { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true },
            { name: "Reason", value: reason, inline: false },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    // Prompt for vouch if ticket was claimed
    if (ticket.claimedBy && ticket.claimedBy !== ticket.userId) {
      const ticketUser = await interaction.guild.members.fetch(ticket.userId).catch(() => null);
      if (ticketUser) {
        const vouchRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`vouch_start_${ticket.claimedBy}`)
            .setLabel("Leave a Vouch")
            .setStyle(ButtonStyle.Success)
            .setEmoji("⭐")
        );
        const vouchEmbed = new EmbedBuilder()
          .setTitle("How was your experience?")
          .setDescription(
            `${ticketUser}, would you like to leave a vouch for <@${ticket.claimedBy}> who helped you?`
          )
          .setColor(0xfee75c);

        const channel = interaction.channel as TextChannel;
        await channel.send({ embeds: [vouchEmbed], components: [vouchRow] });
      }
    }

    // Archive: remove user's view permission after 10 seconds
    setTimeout(async () => {
      try {
        const ch = interaction.guild!.channels.cache.get(ticket.channelId) as TextChannel | undefined;
        if (ch) {
          await ch.permissionOverwrites.edit(ticket.userId, { ViewChannel: false });
        }
      } catch (_) {}
    }, 10000);

  } else if (sub === "claim") {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({ content: "❌ This is not an active ticket channel.", ephemeral: true });
      return;
    }
    if (ticket.claimedBy) {
      await interaction.reply({ content: `❌ This ticket is already claimed by <@${ticket.claimedBy}>.`, ephemeral: true });
      return;
    }

    const isStaff = config?.supportRoleId
      ? (interaction.member as any)?.roles?.cache?.has(config.supportRoleId)
      : false;
    const isAdmin = (interaction.member as any)?.permissions?.has(PermissionFlagsBits.Administrator);

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

  } else if (sub === "add") {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({ content: "❌ This is not an active ticket channel.", ephemeral: true });
      return;
    }

    const isStaff = config?.supportRoleId
      ? (interaction.member as any)?.roles?.cache?.has(config.supportRoleId)
      : false;
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
  }
}
