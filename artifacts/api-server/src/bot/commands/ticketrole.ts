import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig";

function parseDuration(s: string): number | null {
  const m = /^(\d+)(m|h|d)$/.exec(s.trim().toLowerCase());
  if (!m) return null;
  const n = parseInt(m[1]);
  if (m[2] === "m") return n * 60_000;
  if (m[2] === "h") return n * 3_600_000;
  if (m[2] === "d") return n * 86_400_000;
  return null;
}

function formatDuration(ms: number): string {
  if (ms === 0) return "None";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(" ") || "None";
}

export const data = new SlashCommandBuilder()
  .setName("ticketrole")
  .setDescription("Set per-role message requirements and cooldowns for carry tickets")
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set requirements for a specific role")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The role to configure").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("min-messages")
          .setDescription("Minimum messages needed to open a ticket (0 = no requirement)")
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(10000)
      )
      .addStringOption((opt) =>
        opt
          .setName("cooldown")
          .setDescription("Cooldown between tickets, e.g. 30m, 2h, 1d (leave blank to remove)")
          .setRequired(false)
          .setMaxLength(10)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove the custom config for a role (reverts to global setting)")
      .addRoleOption((opt) =>
        opt.setName("role").setDescription("The role to remove").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("view").setDescription("View all role-specific ticket requirements")
  )
  .addSubcommand((sub) =>
    sub
      .setName("global")
      .setDescription("Set a global cooldown between tickets for everyone (leave blank to remove)")
      .addStringOption((opt) =>
        opt
          .setName("cooldown")
          .setDescription("e.g. 30m, 2h, 1d — leave blank to remove the cooldown")
          .setRequired(false)
          .setMaxLength(10)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const isAdmin = (interaction.member as any)?.permissions?.has(BigInt(8));
  if (!isAdmin) {
    await interaction.reply({ content: "❌ Only admins can manage role ticket configs.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const config = await GuildConfig.findOneAndUpdate(
    { guildId: interaction.guildId },
    {},
    { upsert: true, new: true }
  );

  if (sub === "set") {
    const role = interaction.options.getRole("role", true);
    const minMessages = interaction.options.getInteger("min-messages") ?? 0;
    const cooldownRaw = interaction.options.getString("cooldown");
    let cooldownMs = 0;

    if (cooldownRaw) {
      const parsed = parseDuration(cooldownRaw);
      if (parsed === null) {
        await interaction.reply({
          content: "❌ Invalid cooldown format. Use `30m`, `2h`, or `1d`.",
          ephemeral: true,
        });
        return;
      }
      cooldownMs = parsed;
    }

    const idx = config.roleTicketConfigs.findIndex((r) => r.roleId === role.id);
    if (idx === -1) {
      config.roleTicketConfigs.push({ roleId: role.id, minMessages, cooldownMs });
    } else {
      config.roleTicketConfigs[idx].minMessages = minMessages;
      config.roleTicketConfigs[idx].cooldownMs = cooldownMs;
    }
    await config.save();

    const lines: string[] = [];
    if (minMessages > 0) lines.push(`• Min messages: **${minMessages}**`);
    else lines.push(`• Min messages: **None**`);
    lines.push(`• Cooldown: **${formatDuration(cooldownMs)}**`);

    await interaction.reply({
      content: `✅ Ticket config for ${role} updated:\n${lines.join("\n")}`,
      ephemeral: true,
    });

  } else if (sub === "remove") {
    const role = interaction.options.getRole("role", true);
    const idx = config.roleTicketConfigs.findIndex((r) => r.roleId === role.id);
    if (idx === -1) {
      await interaction.reply({ content: `❌ No custom config found for ${role}.`, ephemeral: true });
      return;
    }
    config.roleTicketConfigs.splice(idx, 1);
    await config.save();
    await interaction.reply({
      content: `✅ Custom ticket config for ${role} removed — reverts to global setting.`,
      ephemeral: true,
    });

  } else if (sub === "global") {
    const cooldownRaw = interaction.options.getString("cooldown");
    let cooldownMs = 0;

    if (cooldownRaw) {
      const parsed = parseDuration(cooldownRaw);
      if (parsed === null) {
        await interaction.reply({ content: "❌ Invalid format. Use `30m`, `2h`, or `1d`.", ephemeral: true });
        return;
      }
      cooldownMs = parsed;
    }

    config.ticketCooldownMs = cooldownMs;
    await config.save();

    await interaction.reply({
      content: cooldownMs > 0
        ? `✅ Global ticket cooldown set to **${formatDuration(cooldownMs)}**. Roles with a custom config are unaffected.`
        : `✅ Global ticket cooldown removed.`,
      ephemeral: true,
    });

  } else if (sub === "view") {
    const configs = config.roleTicketConfigs ?? [];
    const embed = new EmbedBuilder()
      .setTitle("🎫 Role Ticket Requirements")
      .setColor(0x5865f2)
      .setTimestamp();

    const globalCooldown = config.ticketCooldownMs ?? 0;
    if (configs.length === 0) {
      embed.setDescription(`No role-specific configs set.\nGlobal cooldown: **${formatDuration(globalCooldown)}** | Min messages: **${config.minMessagesRequired || "None"}**`);
    } else {
      embed.setDescription(`Global cooldown: **${formatDuration(globalCooldown)}** | Min messages: **${config.minMessagesRequired || "None"}**\nUsers with matching roles use the most lenient config.`);
      for (const rc of configs) {
        const role = interaction.guild?.roles.cache.get(rc.roleId);
        const roleName = role ? `@${role.name}` : `<unknown role: ${rc.roleId}>`;
        embed.addFields({
          name: roleName,
          value: `Min messages: **${rc.minMessages || "None"}** | Cooldown: **${formatDuration(rc.cooldownMs)}**`,
          inline: false,
        });
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
