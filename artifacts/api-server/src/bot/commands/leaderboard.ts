import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { Vouch } from "../models/Vouch";

export const data = new SlashCommandBuilder()
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
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

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
