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
      .setDescription("Vouch a user (must be inside a ticket channel)")
      .addUserOption((opt) =>
        opt.setName("member").setDescription("The member to vouch").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for the vouch")
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("add-bulk")
      .setDescription("[Staff] Add multiple vouches to a user at once")
      .addUserOption((opt) =>
        opt.setName("member").setDescription("The member to vouch").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription("Number of vouches to add (1–50)")
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason applied to each vouch")
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("[Staff] Remove the most recent vouches from a user")
      .addUserOption((opt) =>
        opt.setName("member").setDescription("The member to remove vouches from").setRequired(true)
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
      .setDescription("Check a user's vouch count")
      .addUserOption((opt) =>
        opt.setName("member").setDescription("The member to check").setRequired(true)
      )
  );

function isStaffMember(
  interaction: ChatInputCommandInteraction,
  config: Awaited<ReturnType<typeof GuildConfig.findOne>>
): boolean {
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
  reason: string,
  count = 1
): Promise<void> {
  if (!config?.vouchChannelId || !interaction.guild) return;
  const vouchChannel = interaction.guild.channels.cache.get(config.vouchChannelId) as TextChannel | undefined;
  if (!vouchChannel) return;

  const total = await Vouch.countDocuments({ guildId: interaction.guildId!, toUserId: target.id });

  const embed = new EmbedBuilder()
    .setTitle(count > 1 ? `Bulk Vouch (+${count})` : "New Vouch")
    .setThumbnail(target.displayAvatarURL())
    .setColor(0xfee75c)
    .addFields(
      { name: "For", value: `${target} (${target.tag})`, inline: true },
      { name: "From", value: `${interaction.user}`, inline: true },
      { name: "Total Vouches", value: `${total}`, inline: true },
    )
    .setTimestamp();

  if (reason) embed.addFields({ name: "Reason", value: reason });
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
    const target = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") ?? "";

    if (target.id === interaction.user.id) {
      await interaction.reply({ content: "❌ You cannot vouch yourself.", ephemeral: true });
      return;
    }
    if (target.bot) {
      await interaction.reply({ content: "❌ You cannot vouch a bot.", ephemeral: true });
      return;
    }

    const ticket = await Ticket.findOne({
      channelId: interaction.channelId,
      status: { $in: ["open", "claimed"] },
    });

    if (!isStaffMember(interaction, config) && !ticket) {
      await interaction.reply({
        content: "❌ You can only use `/vouch give` inside an active ticket channel.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    await Vouch.create({
      guildId: interaction.guildId,
      fromUserId: interaction.user.id,
      toUserId: target.id,
      reason,
    });

    await postToVouchChannel(interaction, config, target, reason);
    await interaction.editReply({ content: `✅ Vouched ${target}${reason ? ` — "${reason}"` : ""}.` });

    if (ticket && interaction.channel) {
      ticket.status = "closed";
      ticket.closedAt = new Date();
      await ticket.save();
      const ticketChannel = interaction.channel as TextChannel;
      await ticketChannel.send({
        content: `✅ Vouch submitted! This ticket will close in **10 seconds**...`,
      });
      setTimeout(async () => {
        try {
          const ch = interaction.guild!.channels.cache.get(ticket.channelId) as TextChannel | undefined;
          if (ch) await ch.delete("Ticket closed after vouch");
        } catch (_) {}
      }, 10000);
    }

  // ─── /vouch add-bulk ───
  } else if (sub === "add-bulk") {
    if (!isStaffMember(interaction, config)) {
      await interaction.reply({ content: "❌ Only staff can use bulk vouch.", ephemeral: true });
      return;
    }

    const target = interaction.options.getUser("member", true);
    const count = interaction.options.getInteger("count", true);
    const reason = interaction.options.getString("reason") ?? "";

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
      reason,
      ticketId: null,
      createdAt: new Date(),
    }));
    await Vouch.insertMany(docs);

    await postToVouchChannel(interaction, config, target, reason, count);
    await interaction.editReply({
      content: `✅ Added **${count}** vouch${count === 1 ? "" : "es"} for ${target}.`,
    });

  // ─── /vouch remove ───
  } else if (sub === "remove") {
    if (!isStaffMember(interaction, config)) {
      await interaction.reply({ content: "❌ Only staff can remove vouches.", ephemeral: true });
      return;
    }

    const target = interaction.options.getUser("member", true);
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
    const target = interaction.options.getUser("member", true);
    await interaction.deferReply();

    const total = await Vouch.countDocuments({ guildId: interaction.guildId, toUserId: target.id });
    if (total === 0) {
      await interaction.editReply({ content: `${target.tag} has no vouches yet.` });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Vouches for ${target.tag}`)
      .setThumbnail(target.displayAvatarURL())
      .setColor(0xfee75c)
      .addFields({ name: "Total Vouches", value: `${total}`, inline: true })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  }
}
