import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { Vouch } from "../models/Vouch";

export const data = new SlashCommandBuilder()
  .setName("helperprofile")
  .setDescription("View a helper's vouch profile.")
  .addUserOption((opt) =>
    opt
      .setName("member")
      .setDescription("The member to look up (leave blank for yourself)")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

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
    .setTitle(isSelf ? "Your Vouch Profile" : `${target.displayName ?? target.username}'s Vouch Profile`)
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
}
