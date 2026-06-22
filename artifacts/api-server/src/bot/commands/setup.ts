import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig";

export const data = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Configure CarryBot for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("ticket-category")
      .setDescription("Set the category where ticket channels are created")
      .addChannelOption((opt) =>
        opt
          .setName("category")
          .setDescription("The category channel")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("log-channel")
      .setDescription("Set the channel where ticket logs are posted")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The log channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("vouch-channel")
      .setDescription("Set the channel where vouches are posted")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The vouch channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("support-role")
      .setDescription("Set the support staff role")
      .addRoleOption((opt) =>
        opt
          .setName("role")
          .setDescription("The support role")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("min-messages")
      .setDescription("Set the minimum messages required to open a ticket (0 = no requirement)")
      .addIntegerOption((opt) =>
        opt
          .setName("count")
          .setDescription("Minimum message count (0 to disable)")
          .setMinValue(0)
          .setMaxValue(10000)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("games")
      .setDescription("Set the supported games list shown in the ticket panel")
      .addStringOption((opt) =>
        opt
          .setName("list")
          .setDescription("Comma-separated list of games")
          .setRequired(true)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel-image")
      .setDescription("Set the banner image URL shown in the ticket panel")
      .addStringOption((opt) =>
        opt
          .setName("url")
          .setDescription("Direct image URL (must end in .png, .jpg, .gif, etc.)")
          .setRequired(true)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View current CarryBot configuration")
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  let config = await GuildConfig.findOne({ guildId: interaction.guildId });
  if (!config) {
    config = new GuildConfig({ guildId: interaction.guildId });
  }

  if (sub === "ticket-category") {
    const category = interaction.options.getChannel("category", true);
    config.ticketCategoryId = category.id;
    await config.save();
    await interaction.reply({ content: `✅ Ticket category set to **${category.name}**.`, ephemeral: true });

  } else if (sub === "log-channel") {
    const channel = interaction.options.getChannel("channel", true) as TextChannel;
    config.ticketLogChannelId = channel.id;
    await config.save();
    await interaction.reply({ content: `✅ Log channel set to ${channel}.`, ephemeral: true });

  } else if (sub === "vouch-channel") {
    const channel = interaction.options.getChannel("channel", true) as TextChannel;
    config.vouchChannelId = channel.id;
    await config.save();
    await interaction.reply({ content: `✅ Vouch channel set to ${channel}.`, ephemeral: true });

  } else if (sub === "support-role") {
    const role = interaction.options.getRole("role", true);
    config.supportRoleId = role.id;
    await config.save();
    await interaction.reply({ content: `✅ Support role set to **${role.name}**.`, ephemeral: true });

  } else if (sub === "min-messages") {
    const count = interaction.options.getInteger("count", true);
    config.minMessagesRequired = count;
    await config.save();
    const msg = count === 0
      ? "✅ Message requirement disabled. Anyone can open tickets."
      : `✅ Users now need **${count}** messages before opening a ticket.`;
    await interaction.reply({ content: msg, ephemeral: true });

  } else if (sub === "games") {
    const list = interaction.options.getString("list", true);
    const games = list.split(",").map((g) => g.trim()).filter(Boolean);
    if (games.length === 0) {
      await interaction.reply({ content: "❌ Please provide at least one game.", ephemeral: true });
      return;
    }
    if (games.length > 25) {
      await interaction.reply({ content: "❌ Maximum 25 games allowed.", ephemeral: true });
      return;
    }
    config.supportedGames = games;
    await config.save();
    await interaction.reply({
      content: `✅ Supported games updated:\n${games.map((g) => `• ${g}`).join("\n")}`,
      ephemeral: true,
    });

  } else if (sub === "panel-image") {
    const url = interaction.options.getString("url", true);
    config.panelImageUrl = url;
    await config.save();
    await interaction.reply({ content: `✅ Panel image set. Run \`/ticket panel\` to post an updated panel.`, ephemeral: true });

  } else if (sub === "view") {
    const guild = interaction.guild!;
    const category = config.ticketCategoryId ? guild.channels.cache.get(config.ticketCategoryId)?.name ?? "Not found" : "Not set";
    const logCh = config.ticketLogChannelId ? `<#${config.ticketLogChannelId}>` : "Not set";
    const vouchCh = config.vouchChannelId ? `<#${config.vouchChannelId}>` : "Not set";
    const supportRole = config.supportRoleId ? `<@&${config.supportRoleId}>` : "Not set";
    const minMsg = config.minMessagesRequired === 0 ? "Disabled" : `${config.minMessagesRequired} messages`;
    const games = config.supportedGames.length > 0 ? config.supportedGames.join(", ") : "None set";

    const embed = new EmbedBuilder()
      .setTitle("CarryBot Configuration")
      .setColor(0x5865f2)
      .addFields(
        { name: "Ticket Category", value: category, inline: true },
        { name: "Log Channel", value: logCh, inline: true },
        { name: "Vouch Channel", value: vouchCh, inline: true },
        { name: "Support Role", value: supportRole, inline: true },
        { name: "Min Messages Required", value: minMsg, inline: true },
        { name: "Panel Image", value: config.panelImageUrl ? "Set ✅" : "Not set", inline: true },
        { name: "Supported Games", value: games, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
