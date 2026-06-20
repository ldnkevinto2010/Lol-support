import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig";
import { Vouch } from "../models/Vouch";

export const data = new SlashCommandBuilder()
  .setName("vouch")
  .setDescription("Vouch and review system")
  .addSubcommand((sub) =>
    sub
      .setName("give")
      .setDescription("Give a vouch to a user")
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

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const config = await GuildConfig.findOne({ guildId: interaction.guildId });

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

    await interaction.deferReply({ ephemeral: true });

    await Vouch.create({
      guildId: interaction.guildId,
      fromUserId: interaction.user.id,
      toUserId: target.id,
      rating,
      comment,
    });

    // Post to vouch channel if configured
    if (config?.vouchChannelId) {
      const vouchChannel = interaction.guild.channels.cache.get(config.vouchChannelId) as TextChannel | undefined;
      if (vouchChannel) {
        const allVouches = await Vouch.find({ guildId: interaction.guildId, toUserId: target.id });
        const avg = allVouches.reduce((sum, v) => sum + v.rating, 0) / allVouches.length;

        let targetMember;
        try {
          targetMember = await interaction.guild.members.fetch(target.id);
        } catch (_) {}

        const embed = new EmbedBuilder()
          .setTitle("New Vouch")
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

        if (comment) {
          embed.addFields({ name: "Comment", value: comment });
        }

        await vouchChannel.send({ embeds: [embed] });
      }
    }

    await interaction.editReply({ content: `✅ You vouched ${target} with ${starsDisplay(rating)}.` });

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
