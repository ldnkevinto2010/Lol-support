import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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
          .setDescription("Direct image URL — leave blank to remove the current image")
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("helper-role")
      .setDescription("Add or remove a helper role (can see open tickets, /helperprofile, /leaderboard)")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The role to add/remove").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("helper-roles")
      .setDescription("View all helper roles and remove any of them")
  )
  .addSubcommand((sub) =>
    sub
      .setName("staff-role")
      .setDescription("Add or remove a staff role (staff can claim/close/transcript tickets)")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The role to add/remove from staff").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("staff-roles")
      .setDescription("View all staff roles and remove any of them")
  )
  .addSubcommand((sub) =>
    sub
      .setName("bypass-role")
      .setDescription("Add or remove a role that bypasses the message requirement")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The role to add/remove from bypass list").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("bypass-roles")
      .setDescription("View all bypass roles and remove any of them")
  )
  .addSubcommand((sub) =>
    sub
      .setName("ping-role")
      .setDescription("Set the default role pinged when any ticket is created")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The role to ping").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("game-role")
      .setDescription("Map a game to a specific ping role when its tickets are created")
      .addStringOption((opt) =>
        opt
          .setName("game")
          .setDescription("Game name (must match your games list)")
          .setRequired(true)
          .setMaxLength(100)
      )
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The role to ping for this game").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("game-roles")
      .setDescription("View all game → role mappings and remove any of them")
  )
  .addSubcommand((sub) =>
    sub
      .setName("game-mappings")
      .setDescription("View all game → category mappings and remove any of them")
  )
  .addSubcommand((sub) =>
    sub
      .setName("game-category")
      .setDescription("Map a game to a specific ticket category")
      .addStringOption((opt) =>
        opt
          .setName("game")
          .setDescription("Game name (must match exactly what's in your games list)")
          .setRequired(true)
          .setMaxLength(100)
      )
      .addChannelOption((opt) =>
        opt
          .setName("category")
          .setDescription("The Discord category tickets for this game go into")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("application-channel")
      .setDescription("Set the channel where helper applications are sent for review")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("The review channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("application-image")
      .setDescription("Set the banner image URL for the application panel")
      .addStringOption((opt) =>
        opt
          .setName("url")
          .setDescription("Direct image URL — leave blank to remove the current image")
          .setRequired(false)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("application-game-role")
      .setDescription("Map a game to the roles given to accepted helpers (game role + base helper role)")
      .addStringOption((opt) =>
        opt
          .setName("game")
          .setDescription("Game name (must match your games list)")
          .setRequired(true)
          .setMaxLength(100)
      )
      .addRoleOption((opt) =>
        opt
          .setName("game-role")
          .setDescription("Game-specific helper role (e.g. UTD Helper)")
          .setRequired(true)
      )
      .addRoleOption((opt) =>
        opt
          .setName("base-role")
          .setDescription("Base helper role given to all accepted helpers")
          .setRequired(true)
      )
      .addRoleOption((opt) =>
        opt
          .setName("notify-role")
          .setDescription("Role pinged in the review channel when this game gets an application")
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("application-image-guide")
      .setDescription("Set the text shown when users click 'How to send an image' on the application panel")
  )
  .addSubcommand((sub) =>
    sub
      .setName("application-cooldown")
      .setDescription("Set how long a user must wait before re-applying for a specific game")
      .addStringOption((opt) =>
        opt
          .setName("game")
          .setDescription("Game name (must match your application games list)")
          .setRequired(true)
          .setMaxLength(100)
      )
      .addStringOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Cooldown duration e.g. 30m, 3h, 7d — leave blank to remove the cooldown")
          .setRequired(false)
          .setMaxLength(20)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("application-game")
      .setDescription("Add or remove a game from the application panel (toggles)")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Game name to add or remove")
          .setRequired(true)
          .setMaxLength(100)
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

  } else if (sub === "helper-role") {
    const role = interaction.options.getRole("role", true);
    const helperRoles = config.helperRoles ?? [];
    const idx = helperRoles.indexOf(role.id);
    if (idx >= 0) {
      config.helperRoles.splice(idx, 1);
      await config.save();
      await interaction.reply({ content: `✅ **${role.name}** removed from helper roles.`, ephemeral: true });
    } else {
      config.helperRoles.push(role.id);
      await config.save();
      await interaction.reply({ content: `✅ **${role.name}** added as a helper role — members can see open tickets and use \`/helperprofile\` and \`/leaderboard\`.`, ephemeral: true });
    }

  } else if (sub === "helper-roles") {
    const roles = config.helperRoles ?? [];
    if (roles.length === 0) {
      await interaction.reply({ content: "No helper roles set. Use `/setup helper-role` to add one.", ephemeral: true });
      return;
    }
    const lines = roles.map((id) => `• <@&${id}>`);
    const embed = new EmbedBuilder()
      .setTitle("Helper Roles")
      .setColor(0x57f287)
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Use the dropdown to remove a role" });

    const select = new StringSelectMenuBuilder()
      .setCustomId("setup_remove_helper_role")
      .setPlaceholder("Select a role to remove from helpers...")
      .addOptions(
        roles.map((id) => {
          const roleName = interaction.guild!.roles.cache.get(id)?.name ?? id;
          return new StringSelectMenuOptionBuilder()
            .setLabel(roleName)
            .setValue(id)
            .setDescription(`Remove ${roleName} from helper roles`);
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

  } else if (sub === "staff-role") {
    const role = interaction.options.getRole("role", true);
    const staffRoles = config.staffRoles ?? [];
    const idx = staffRoles.indexOf(role.id);
    if (idx >= 0) {
      config.staffRoles.splice(idx, 1);
      await config.save();
      await interaction.reply({ content: `✅ **${role.name}** removed from staff roles.`, ephemeral: true });
    } else {
      config.staffRoles.push(role.id);
      await config.save();
      await interaction.reply({ content: `✅ **${role.name}** added as a staff role — members can now claim, close, and transcript tickets.`, ephemeral: true });
    }

  } else if (sub === "staff-roles") {
    const roles = config.staffRoles ?? [];
    if (roles.length === 0) {
      await interaction.reply({ content: "No staff roles set. Use `/setup staff-role` to add one.", ephemeral: true });
      return;
    }
    const lines = roles.map((id) => `• <@&${id}>`);
    const embed = new EmbedBuilder()
      .setTitle("Staff Roles")
      .setColor(0xe67e22)
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Use the dropdown to remove a role" });

    const select = new StringSelectMenuBuilder()
      .setCustomId("setup_remove_staff_role")
      .setPlaceholder("Select a role to remove from staff...")
      .addOptions(
        roles.map((id) => {
          const roleName = interaction.guild!.roles.cache.get(id)?.name ?? id;
          return new StringSelectMenuOptionBuilder()
            .setLabel(roleName)
            .setValue(id)
            .setDescription(`Remove ${roleName} from staff roles`);
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

  } else if (sub === "bypass-role") {
    const role = interaction.options.getRole("role", true);
    const bypassRoles = config.bypassRoles ?? [];
    const idx = bypassRoles.indexOf(role.id);
    if (idx >= 0) {
      config.bypassRoles.splice(idx, 1);
      await config.save();
      await interaction.reply({ content: `✅ **${role.name}** removed from bypass roles.`, ephemeral: true });
    } else {
      config.bypassRoles.push(role.id);
      await config.save();
      await interaction.reply({ content: `✅ **${role.name}** added — members with this role bypass the message requirement.`, ephemeral: true });
    }

  } else if (sub === "bypass-roles") {
    const roles = config.bypassRoles ?? [];
    if (roles.length === 0) {
      await interaction.reply({ content: "No bypass roles set. Use `/setup bypass-role` to add one.", ephemeral: true });
      return;
    }
    const lines = roles.map((id) => `• <@&${id}>`);
    const embed = new EmbedBuilder()
      .setTitle("Message Requirement Bypass Roles")
      .setColor(0x5865f2)
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Use the dropdown to remove a role" });

    const select = new StringSelectMenuBuilder()
      .setCustomId("setup_remove_bypass_role")
      .setPlaceholder("Select a role to remove from bypass list...")
      .addOptions(
        roles.map((id) => {
          const roleName = interaction.guild!.roles.cache.get(id)?.name ?? id;
          return new StringSelectMenuOptionBuilder()
            .setLabel(roleName)
            .setValue(id)
            .setDescription(`Remove ${roleName} from bypass list`);
        })
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

  } else if (sub === "ping-role") {
    const role = interaction.options.getRole("role", true);
    config.supportRoleId = role.id;
    await config.save();
    await interaction.reply({
      content: `✅ Default ping role set to **${role.name}**. All tickets will ping this role unless a game-specific role is set.`,
      ephemeral: true,
    });

  } else if (sub === "game-role") {
    const gameName = interaction.options.getString("game", true).trim();
    const role = interaction.options.getRole("role", true);
    const existing = config.gameRoles?.findIndex(
      (gr) => gr.game.toLowerCase() === gameName.toLowerCase()
    ) ?? -1;
    if (existing >= 0) {
      config.gameRoles[existing]!.roleId = role.id;
    } else {
      config.gameRoles.push({ game: gameName, roleId: role.id });
    }
    await config.save();
    await interaction.reply({
      content: `✅ Tickets for **${gameName}** will now ping **${role.name}**.`,
      ephemeral: true,
    });

  } else if (sub === "game-roles") {
    const mappings = config.gameRoles ?? [];

    if (mappings.length === 0) {
      await interaction.reply({
        content: "No game → role mappings set yet. Use `/setup game-role` to add one.",
        ephemeral: true,
      });
      return;
    }

    const lines = mappings.map((gr) => `• **${gr.game}** → <@&${gr.roleId}>`);

    const embed = new EmbedBuilder()
      .setTitle("Game → Role Mappings")
      .setColor(0x5865f2)
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Use the dropdown below to remove a mapping" });

    const select = new StringSelectMenuBuilder()
      .setCustomId("setup_remove_game_role")
      .setPlaceholder("Select a game to remove its role mapping...")
      .addOptions(
        mappings.map((gr) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(gr.game)
            .setValue(gr.game)
            .setDescription(`Remove role mapping for ${gr.game}`)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

  } else if (sub === "game-mappings") {
    const mappings = config.gameCategories ?? [];

    if (mappings.length === 0) {
      await interaction.reply({
        content: "No game → category mappings set yet. Use `/setup game-category` to add one.",
        ephemeral: true,
      });
      return;
    }

    const lines = mappings.map((gc) => {
      const ch = interaction.guild!.channels.cache.get(gc.categoryId);
      return `• **${gc.game}** → ${ch ? `**${ch.name}**` : `\`${gc.categoryId}\``}`;
    });

    const embed = new EmbedBuilder()
      .setTitle("Game → Category Mappings")
      .setColor(0x5865f2)
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Use the dropdown below to remove a mapping" });

    const select = new StringSelectMenuBuilder()
      .setCustomId("setup_remove_game_mapping")
      .setPlaceholder("Select a game to remove its mapping...")
      .addOptions(
        mappings.map((gc) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(gc.game)
            .setValue(gc.game)
            .setDescription(`Remove mapping for ${gc.game}`)
        )
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

  } else if (sub === "game-category") {
    const gameName = interaction.options.getString("game", true).trim();
    const category = interaction.options.getChannel("category", true);
    const existing = config.gameCategories?.findIndex(
      (gc) => gc.game.toLowerCase() === gameName.toLowerCase()
    ) ?? -1;
    if (existing >= 0) {
      config.gameCategories[existing]!.categoryId = category.id;
    } else {
      config.gameCategories.push({ game: gameName, categoryId: category.id });
    }
    await config.save();
    await interaction.reply({
      content: `✅ Tickets for **${gameName}** will now go into the **${category.name}** category.`,
      ephemeral: true,
    });

  } else if (sub === "panel-image") {
    const url = interaction.options.getString("url");
    config.panelImageUrl = url ?? null;
    await config.save();
    const msg = url
      ? `✅ Panel image set. Run \`/ticket panel\` to post an updated panel.`
      : `✅ Panel image cleared. Run \`/ticket panel\` to post an updated panel.`;
    await interaction.reply({ content: msg, ephemeral: true });

  } else if (sub === "application-channel") {
    const channel = interaction.options.getChannel("channel", true) as TextChannel;
    config.applicationChannelId = channel.id;
    await config.save();
    await interaction.reply({ content: `✅ Application review channel set to ${channel}.`, ephemeral: true });

  } else if (sub === "application-image") {
    const url = interaction.options.getString("url");
    config.applicationPanelImageUrl = url ?? null;
    await config.save();
    const msg = url
      ? `✅ Application panel image set. Run \`/applicationpanel\` to post an updated panel.`
      : `✅ Application panel image cleared.`;
    await interaction.reply({ content: msg, ephemeral: true });

  } else if (sub === "application-game-role") {
    const gameName = interaction.options.getString("game", true).trim();
    const gameRole = interaction.options.getRole("game-role", true);
    const baseRole = interaction.options.getRole("base-role", true);
    const notifyRole = interaction.options.getRole("notify-role");

    if (!config.applicationRoles) config.applicationRoles = [];
    const idx = config.applicationRoles.findIndex(
      (ar) => ar.game.toLowerCase() === gameName.toLowerCase()
    );
    const entry = {
      game: gameName,
      gameRoleId: gameRole.id,
      baseRoleId: baseRole.id,
      notifyRoleId: notifyRole?.id,
    };
    if (idx >= 0) {
      config.applicationRoles[idx] = entry;
    } else {
      config.applicationRoles.push(entry);
    }
    await config.save();
    await interaction.reply({
      content: `✅ **${gameName}** applications: accepted helpers get <@&${gameRole.id}> + <@&${baseRole.id}>${notifyRole ? `, ping <@&${notifyRole.id}>` : ""}.`,
      ephemeral: true,
    });

  } else if (sub === "application-image-guide") {
    const current = config.applicationImageGuideText ?? "";
    const modal = new ModalBuilder()
      .setCustomId("setup_img_guide_modal")
      .setTitle("Image Guide Text");

    const textInput = new TextInputBuilder()
      .setCustomId("guide_text")
      .setLabel("Guide content (markdown + image/gif URLs ok)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Write your guide here. Paste a GIF URL on its own line to embed it.")
      .setRequired(false)
      .setMaxLength(2000);

    if (current) textInput.setValue(current);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
    await interaction.showModal(modal);

  } else if (sub === "application-cooldown") {
    const gameName = interaction.options.getString("game", true).trim();
    const durationStr = interaction.options.getString("duration");

    if (!config.applicationRoles) config.applicationRoles = [];
    let idx = config.applicationRoles.findIndex(
      (ar) => ar.game.toLowerCase() === gameName.toLowerCase()
    );

    if (!durationStr) {
      if (idx >= 0) {
        config.applicationRoles[idx]!.cooldownMs = undefined;
        await config.save();
      }
      await interaction.reply({ content: `✅ Cooldown removed for **${gameName}** applications.`, ephemeral: true });
      return;
    }

    const match = durationStr.trim().match(/^(\d+(?:\.\d+)?)\s*(m|h|d)$/i);
    if (!match) {
      await interaction.reply({ content: "❌ Invalid duration format. Use `30m`, `3h`, or `7d`.", ephemeral: true });
      return;
    }
    const val = parseFloat(match[1]!);
    const unit = match[2]!.toLowerCase();
    const ms = unit === "m" ? val * 60_000 : unit === "h" ? val * 3_600_000 : val * 86_400_000;

    if (idx >= 0) {
      config.applicationRoles[idx]!.cooldownMs = ms;
    } else {
      config.applicationRoles.push({ game: gameName, gameRoleId: "", baseRoleId: "", cooldownMs: ms });
      idx = config.applicationRoles.length - 1;
    }
    await config.save();
    await interaction.reply({
      content: `✅ Users must now wait **${durationStr}** before re-applying for **${gameName}**.`,
      ephemeral: true,
    });

  } else if (sub === "application-game") {
    const name = interaction.options.getString("name", true).trim();
    if (!config.applicationGames) config.applicationGames = [];
    const idx = config.applicationGames.findIndex((g) => g.toLowerCase() === name.toLowerCase());
    if (idx >= 0) {
      config.applicationGames.splice(idx, 1);
      await config.save();
      await interaction.reply({ content: `✅ **${name}** removed from the application panel games.`, ephemeral: true });
    } else {
      if (config.applicationGames.length >= 25) {
        await interaction.reply({ content: "❌ Maximum 25 games allowed.", ephemeral: true });
        return;
      }
      config.applicationGames.push(name);
      await config.save();
      await interaction.reply({ content: `✅ **${name}** added to the application panel games.`, ephemeral: true });
    }

  } else if (sub === "view") {
    const guild = interaction.guild!;
    const category = config.ticketCategoryId ? guild.channels.cache.get(config.ticketCategoryId)?.name ?? "Not found" : "Not set";
    const logCh = config.ticketLogChannelId ? `<#${config.ticketLogChannelId}>` : "Not set";
    const vouchCh = config.vouchChannelId ? `<#${config.vouchChannelId}>` : "Not set";
    const supportRole = config.supportRoleId ? `<@&${config.supportRoleId}>` : "Not set";
    const minMsg = config.minMessagesRequired === 0 ? "Disabled" : `${config.minMessagesRequired} messages`;
    const games = config.supportedGames.length > 0 ? config.supportedGames.join(", ") : "None set";

    const gameCategoryList = (config.gameCategories ?? []).length > 0
      ? config.gameCategories.map((gc) => {
          const ch = interaction.guild!.channels.cache.get(gc.categoryId);
          return `• **${gc.game}** → ${ch?.name ?? gc.categoryId}`;
        }).join("\n")
      : "None set";

    const embed = new EmbedBuilder()
      .setTitle("CarryBot Configuration")
      .setColor(0x5865f2)
      .addFields(
        { name: "Default Ticket Category", value: category, inline: true },
        { name: "Log Channel", value: logCh, inline: true },
        { name: "Vouch Channel", value: vouchCh, inline: true },
        { name: "Min Messages Required", value: minMsg, inline: true },
        { name: "Panel Image", value: config.panelImageUrl ? "Set ✅" : "Not set", inline: true },
        { name: "Supported Games", value: games, inline: false },
        { name: "Game → Category Mappings", value: gameCategoryList, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
