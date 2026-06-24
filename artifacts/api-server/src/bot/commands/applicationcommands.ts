import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("applicationcommands")
  .setDescription("View all helper application commands, what they do, and who can use them");

const FIELDS = [
  {
    name: "📋 Panel",
    value: [
      "`/applicationpanel [channel]` — Post the helper application panel in a channel\n> **Who:** Admins",
    ].join("\n\n"),
  },
  {
    name: "📝 Applying",
    value: [
      "**Apply to be a Helper** *(button on panel)* — Opens a game selector then a 5-question application modal\n> **Who:** Everyone",
      "**How to send images in your application** *(button on panel)* — Shows instructions for attaching images via URL\n> **Who:** Everyone",
    ].join("\n\n"),
  },
  {
    name: "✅ Reviewing Applications",
    value: [
      "**Accept** *(button on review embed)* — Accepts the application, gives the applicant their helper roles, and DMs them\n> **Who:** Staff, Admins",
      "**Reject** *(button on review embed)* — Rejects the application and DMs the applicant\n> **Who:** Staff, Admins",
    ].join("\n\n"),
  },
  {
    name: "⚙️ Setup (Admin Only)",
    value: [
      "`/setup application-channel <channel>` — Set the channel where applications are sent for review\n> **Who:** Admins",
      "`/setup application-image <url>` — Set the banner image shown on the application panel\n> **Who:** Admins",
      "`/setup application-game <name>` — Add or remove a game from the application panel\n> **Who:** Admins",
      "`/setup application-game-role <game> <game-role> <base-role> [notify-role]` — Map a game to the roles given to accepted helpers (also sets the ping role via the optional notify-role)\n> **Who:** Admins",
      "`/setup application-cooldown <game> [duration]` — Set how long users must wait before re-applying for a game (e.g. `3h`, `7d`) — omit duration to remove the cooldown\n> **Who:** Admins",
      "`/setup application-image-guide [text]` — Set the message shown when users click 'How to send an image' (supports markdown and gif/image URLs) — omit to reset to default\n> **Who:** Admins",
    ].join("\n\n"),
  },
];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("📋 Application Commands")
    .setColor(0xe91e8c)
    .setDescription("All commands related to the helper application system.")
    .setTimestamp();

  for (const field of FIELDS) {
    embed.addFields({ name: field.name, value: field.value, inline: false });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
