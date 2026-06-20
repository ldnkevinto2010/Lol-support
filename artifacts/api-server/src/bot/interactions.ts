import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  EmbedBuilder,
  TextChannel,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { GuildConfig } from "./models/GuildConfig";
import { Ticket } from "./models/Ticket";
import { Vouch } from "./models/Vouch";

function starsDisplay(rating: number): string {
  return "⭐".repeat(rating) + "☆".repeat(5 - rating);
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, guildId, guild } = interaction;
  if (!guildId || !guild) return;

  const config = await GuildConfig.findOne({ guildId });

  // ─── Close ticket button ───
  if (customId === "ticket_close") {
    const ticket = await Ticket.findOne({ channelId: interaction.channelId });
    if (!ticket || ticket.status === "closed") {
      await interaction.reply({ content: "❌ This ticket is already closed.", ephemeral: true });
      return;
    }

    const isStaff = config?.supportRoleId
      ? (interaction.member as any)?.roles?.cache?.has(config.supportRoleId)
      : false;
    const isOwner = ticket.userId === interaction.user.id;
    const isAdmin = (interaction.member as any)?.permissions?.has(BigInt(8));

    if (!isStaff && !isOwner && !isAdmin) {
      await interaction.reply({ content: "❌ You don't have permission to close this ticket.", ephemeral: true });
      return;
    }

    ticket.status = "closed";
    ticket.closedAt = new Date();
    await ticket.save();

    const closeEmbed = new EmbedBuilder()
      .setTitle("Ticket Closed")
      .setColor(0xed4245)
      .addFields({ name: "Closed By", value: `${interaction.user}`, inline: true })
      .setTimestamp();

    await interaction.reply({ embeds: [closeEmbed] });

    // Log closure
    if (config?.ticketLogChannelId) {
      const logChannel = guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle("Ticket Closed")
          .setColor(0xed4245)
          .addFields(
            { name: "Ticket", value: `#${String(ticket.ticketNumber).padStart(4, "0")}`, inline: true },
            { name: "Opened By", value: `<@${ticket.userId}>`, inline: true },
            { name: "Closed By", value: `${interaction.user}`, inline: true },
            { name: "Claimed By", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: true },
          )
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    }

    // Prompt vouch if ticket was claimed
    if (ticket.claimedBy && ticket.claimedBy !== ticket.userId) {
      const ticketUser = await guild.members.fetch(ticket.userId).catch(() => null);
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

    // Remove user's view permission after 10 seconds
    setTimeout(async () => {
      try {
        const ch = guild.channels.cache.get(ticket.channelId) as TextChannel | undefined;
        if (ch) {
          await ch.permissionOverwrites.edit(ticket.userId, { ViewChannel: false });
        }
      } catch (_) {}
    }, 10000);

    return;
  }

  // ─── Claim ticket button ───
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

  // ─── Vouch start button (vouch_start_<userId>) ───
  if (customId.startsWith("vouch_start_")) {
    const targetUserId = customId.replace("vouch_start_", "");

    // Only the ticket owner can leave the vouch
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

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId, guildId, guild } = interaction;
  if (!guildId || !guild) return;

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

        if (comment) {
          embed.addFields({ name: "Comment", value: comment });
        }

        if (targetUser) {
          embed.setThumbnail(targetUser.displayAvatarURL());
        }

        await vouchChannel.send({ embeds: [embed] });
      }
    }

    await interaction.editReply({ content: `✅ Thanks! Your vouch (${starsDisplay(rating)}) has been recorded.` });
  }
}
