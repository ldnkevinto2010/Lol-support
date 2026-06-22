import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { Vouch } from "../models/Vouch";

export const data = new SlashCommandBuilder()
  .setName("helperprofile")
  .setDescription("View a helper's vouch profile.")
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View your own or another member's vouch profile")
      .addUserOption((opt) =>
        opt
          .setName("member")
          .setDescription("The member to look up (leave blank for yourself)")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("leaderboard")
      .setDescription("Top vouched helpers for a time period")
      .addStringOption((opt) =>
        opt
          .setName("period")
          .setDescription("Time period")
          .setRequired(true)
          .addChoices(
            { name: "Weekly (last 7 days)", value: "weekly" },
            { name: "Monthly (last 30 days)", value: "monthly" }
          )
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  // ─── /helperprofile view ───
  if (sub === "view") {
    const target = interaction.options.getUser("member") ?? interaction.user;
    const isSelf = target.id === interaction.user.id;

    await interaction.deferReply();

    const total = await Vouch.countDocuments({ guildId: interaction.guildId, toUserId: target.id });

    const now = Date.now();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const weeklyCount = await Vouch.countDocuments({
      guildId: interaction.guildId,
      toUserId: target.id,
      createdAt: { $gte: weekAgo },
    });

    const monthlyCount = await Vouch.countDocuments({
      guildId: interaction.guildId,
      toUserId: target.id,
      createdAt: { $gte: monthAgo },
    });

    const recent = await Vouch.find({ guildId: interaction.guildId, toUserId: target.id })
      .sort({ createdAt: -1 })
      .limit(3);

    let member;
    try {
      member = await interaction.guild.members.fetch(target.id);
    } catch (_) {}

    const embed = new EmbedBuilder()
      .setTitle(`${isSelf ? "Your Vouch Profile" : `${target.displayName ?? target.username}'s Vouch Profile`}`)
      .setColor(0x5865f2)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: "Total Vouches", value: `${total}`, inline: true },
        { name: "This Week", value: `${weeklyCount}`, inline: true },
        { name: "This Month", value: `${monthlyCount}`, inline: true },
      )
      .setFooter({ text: `User ID: ${target.id}` })
      .setTimestamp();

    if (recent.length > 0) {
      const lines: string[] = [];
      for (const v of recent) {
        const fromUser = await interaction.client.users.fetch(v.fromUserId).catch(() => null);
        const from = fromUser ? `<@${fromUser.id}>` : `<@${v.fromUserId}>`;
        const ts = Math.floor(v.createdAt.getTime() / 1000);
        lines.push(`${from} — ${v.reason ? `"${v.reason}"` : "_no reason_"} · <t:${ts}:R>`);
      }
      embed.addFields({ name: "Recent Vouches", value: lines.join("\n") });
    } else {
      embed.addFields({ name: "Recent Vouches", value: "_None yet_" });
    }

    if (member?.joinedAt) {
      const joinTs = Math.floor(member.joinedAt.getTime() / 1000);
      embed.addFields({ name: "Joined Server", value: `<t:${joinTs}:D>`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });

  // ─── /helperprofile leaderboard ───
  } else if (sub === "leaderboard") {
    const period = interaction.options.getString("period", true) as "weekly" | "monthly";
    const days = period === "weekly" ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const label = period === "weekly" ? "Weekly" : "Monthly";

    await interaction.deferReply();

    const results = await Vouch.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          guildId: interaction.guildId,
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: "$toUserId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    if (results.length === 0) {
      await interaction.editReply({ content: `No vouches recorded in the last ${days} days.` });
      return;
    }

    const medals = ["🥇", "🥈", "🥉"];
    const lines: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const entry = results[i]!;
      const prefix = medals[i] ?? `**#${i + 1}**`;
      lines.push(`${prefix} <@${entry._id}> — **${entry.count}** vouch${entry.count === 1 ? "" : "es"}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${label} Vouch Leaderboard`)
      .setColor(0xfee75c)
      .setDescription(lines.join("\n"))
      .setFooter({ text: `Last ${days} days` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
