import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig";
import { Vouch } from "../models/Vouch";
import { Ticket } from "../models/Ticket";

export const data = new SlashCommandBuilder()
  .setName("vouch")
  .setDescription("Vouch and review system")
  .addSubcommand((sub) =>
    sub
      .setName("give")
      .setDescription("Give a vouch to a user (must be used inside a ticket channel)")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to vouch").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("rating")
          .setDescription("Rating from 1 to 5 stars")
          .setMinValue(1)
          .setMaxValue(5)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("comment")
          .setDescription("Your review comment")
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("add-bulk")
      .setDescription("[Staff] Add multiple vouches to a user at once")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to vouch").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription("Number of vouches to add (1–50)")
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("rating")
          .setDescription("Rating from 1 to 5 stars")
          .setMinValue(1)
          .setMaxValue(5)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("comment")
          .setDescription("Comment applied to each vouch")
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("[Staff] Remove the most recent vouches from a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to remove vouches from").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription("How many recent vouches to remove (default: 1)")
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("check")
      .setDescription("Check a user's vouch count and average rating")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to check").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("recent")
      .setDescription("See the most recent vouches for a user")
      .addUserOption((opt) =>
        opt.setName("user").setDescription("The user to check").setRequired(true)
      )
  );

function starsDisplay(rating: number): string {
  return "⭐".repeat(rating) + "☆".repeat(5 - rating);
}

function isStaffMember(interaction: ChatInputCommandInteraction, config: Awaited<ReturnType<typeof GuildConfig.findOne>>): boolean {
  const isAdmin = (interaction.member as any)?.permissions?.has(BigInt(8));
  const hasStaffRole = (config?.staffRoles ?? []).some(
    (id) => (interaction.member as any)?.roles?.cache?.has(id)
  );
  return isAdmin || hasStaffRole;
}

async function postToVouchChannel(
  interaction: ChatInputCommandInteraction,
  config: Awaited<ReturnType<typeof GuildConfig.findOne>>,
  target: import("discord.js").User,
  rating: number,
  comment: string,
  count = 1
): Promise<void> {
  if (!config?.vouchChannelId || !interaction.guild) return;
  const vouchChannel = interaction.guild.channels.cache.get(config.vouchChannelId) as TextChannel | undefined;
  if (!vouchChannel) return;

  const allVouches = await Vouch.find({ guildId: interaction.guildId!, toUserId: target.id });
  const avg = allVouches.reduce((sum, v) => sum + v.rating, 0) / allVouches.length;

  const embed = new EmbedBuilder()
    .setTitle(count > 1 ? `Bulk Vouch (+${count})` : "New Vouch")
    .setThumbnail(target.displayAvatarURL())
    .setColor(0xfee75c)
    .addFields(
      { name: "For", value: `${target} (${target.tag})`, inline: true },
      { name: "From", value: `${interaction.user}`, inline: true },
      { name: "Rating", value: starsDisplay(rating), inline: true },
      { name: "Total Vouches", value: `${allVouches.length}`, inline: true },
      { name: "Average Rating", value: `${avg.toFixed(2)} / 5.00`, inline: true },
    )
    .setTimestamp();

  if (comment) embed.addFields({ name: "Comment", value: comment });
  if (count > 1) embed.addFields({ name: "Vouches Added", value: `${count}`, inline: true });

  await vouchChannel.send({ embeds: [embed] });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const config = await GuildConfig.findOne({ guildId: interaction.guildId });

  // ─── /vouch give ───
  if (sub === "give") {
    const target = interaction.options.getUser("user", true);
    const rating = interaction.options.getInteger("rating", true);
    const comment = interaction.options.getString("comment") ?? "";

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "❌ You cannot vouch yourself.", ephemeral: true });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "❌ You cannot vouch a bot.", ephemeral: true });
      return;
    }

    // Normal members must use this inside a ticket channel; staff/admins can use it anywhere
    if (!isStaffMember(interaction, config)) {
      const ticket = await Ticket.findOne({ channelId: interaction.channelId, status: { $in: ["open", "claimed"] } });
      if (!ticket) {
        await interaction.reply({ content: "❌ You can only use `/vouch give` inside an active ticket channel.", ephemeral: true });
        return;
      }
    }

    await interaction.deferReply({ ephemeral: true });

    await Vouch.create({
      guildId: interaction.guildId,
      fromUserId: interaction.user.id,
      toUserId: target.id,
      rating,
      comment,
    });

    await postToVouchChannel(interaction, config, target, rating, comment);
    await interaction.editReply({ content: `✅ You vouched ${target} with ${starsDisplay(rating)}.` });

  // ─── /vouch add-bulk ───
  } else if (sub === "add-bulk") {
    if (!isStaffMember(interaction, config)) {
      await interaction.reply({ content: "❌ Only staff can use bulk vouch.", ephemeral: true });
      return;
    }

    const target = interaction.options.getUser("user", true);
    const count = interaction.options.getInteger("count", true);
    const rating = interaction.options.getInteger("rating", true);
    const comment = interaction.options.getString("comment") ?? "";

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "❌ You cannot vouch yourself.", ephemeral: true });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "❌ You cannot vouch a bot.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const docs = Array.from({ length: count }, () => ({
      guildId: interaction.guildId!,
      fromUserId: interaction.user.id,
      toUserId: target.id,
      rating,
      comment,
      ticketId: null,
      createdAt: new Date(),
    }));
    await Vouch.insertMany(docs);

    await postToVouchChannel(interaction, config, target, rating, comment, count);
    await interaction.editReply({ content: `✅ Added **${count}** vouch${count === 1 ? "" : "es"} (${starsDisplay(rating)}) for ${target}.` });

  // ─── /vouch remove ───
  } else if (sub === "remove") {
    if (!isStaffMember(interaction, config)) {
      await interaction.reply({ content: "❌ Only staff can remove vouches.", ephemeral: true });
      return;
    }

    const target = interaction.options.getUser("user", true);
    const count = interaction.options.getInteger("count") ?? 1;

    await interaction.deferReply({ ephemeral: true });

    const recent = await Vouch.find({ guildId: interaction.guildId, toUserId: target.id })
      .sort({ createdAt: -1 })
      .limit(count);

    if (recent.length === 0) {
      await interaction.editReply({ content: `❌ ${target.tag} has no vouches to remove.` });
      return;
    }

    const ids = recent.map((v) => v._id);
    await Vouch.deleteMany({ _id: { $in: ids } });

    await interaction.editReply({
      content: `✅ Removed **${recent.length}** vouch${recent.length === 1 ? "" : "es"} from ${target}.`,
    });

  // ─── /vouch check ───
  } else if (sub === "check") {
    const target = interaction.options.getUser("user", true);
    await interaction.deferReply();

    const vouches = await Vouch.find({ guildId: interaction.guildId, toUserId: target.id });
    if (vouches.length === 0) {
      await interaction.editReply({ content: `${target.tag} has no vouches yet.` });
      return;
    }

    const avg = vouches.reduce((sum, v) => sum + v.rating, 0) / vouches.length;
    const counts = [1, 2, 3, 4, 5].map((r) => vouches.filter((v) => v.rating === r).length);

    const embed = new EmbedBuilder()
      .setTitle(`Vouches for ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0xfee75c)
      .addFields(
        { name: "Total Vouches", value: `${vouches.length}`, inline: true },
        { name: "Average Rating", value: `${avg.toFixed(2)} / 5.00`, inline: true },
        {
          name: "Breakdown",
          value: [5, 4, 3, 2, 1].map((r) => `${"⭐".repeat(r)} — ${counts[r - 1]}`).join("\n"),
        },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  // ─── /vouch recent ───
  } else if (sub === "recent") {
    const target = interaction.options.getUser("user", true);
    await interaction.deferReply();

    const vouches = await Vouch.find({ guildId: interaction.guildId, toUserId: target.id })
      .sort({ createdAt: -1 })
      .limit(5);

    if (vouches.length === 0) {
      await interaction.editReply({ content: `${target.tag} has no vouches yet.` });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Recent Vouches for ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0xfee75c)
      .setTimestamp();

    for (const v of vouches) {
      const fromUser = await interaction.client.users.fetch(v.fromUserId).catch(() => null);
      const from = fromUser ? fromUser.tag : `<@${v.fromUserId}>`;
      const ts = Math.floor(v.createdAt.getTime() / 1000);
      embed.addFields({
        name: `${starsDisplay(v.rating)} — from ${from}`,
        value: (v.comment || "_No comment_") + `\n<t:${ts}:R>`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
}
