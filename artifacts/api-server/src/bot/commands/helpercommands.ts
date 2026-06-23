import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("helpercommands")
  .setDescription("View all helper-related commands, what they do, and who can use them");

const FIELDS = [
  {
    name: "🎫 Ticket Commands",
    value: [
      "`/ticket close [reason]` — Close the ticket and log it\n> **Who:** Ticket creator, Helpers, Staff, Admins",
      "`/ticket transcript` — Generate a full chat transcript\n> **Who:** Staff, Admins only",
    ].join("\n\n"),
  },
  {
    name: "✋ Claim / Unclaim Buttons",
    value: [
      "**Claim Ticket** — Locks the ticket to claimer + creator + staff only\n> **Who:** Helpers, Staff, Admins",
      "**Unclaim Ticket** — Restores open-ticket permissions\n> **Who:** The claimer, Helpers, Staff, Admins",
    ].join("\n\n"),
  },
  {
    name: "⭐ Vouch Commands",
    value: [
      "`/vouch give <user> [comment]` — Give a vouch to a user\n> **Who:** Everyone (non-staff must be in a ticket channel)",
      "`/vouch check <user>` — View total vouches and breakdown\n> **Who:** Everyone",
      "`/vouch recent <user>` — See the 5 most recent vouches\n> **Who:** Everyone",
      "`/vouch add-bulk <user> <count>` — Add multiple vouches at once\n> **Who:** Staff, Admins",
      "`/vouch remove <user>` — Remove a vouch from a user\n> **Who:** Staff, Admins",
    ].join("\n\n"),
  },
  {
    name: "📊 Profile & Leaderboard",
    value: [
      "`/helperprofile [user]` — View tickets claimed, vouches given/received, and activity\n> **Who:** Helpers, Staff",
      "`/leaderboard` — View the top helpers ranked by activity\n> **Who:** Helpers, Staff",
    ].join("\n\n"),
  },
  {
    name: "⚙️ Setup (Admin Only)",
    value: [
      "`/setup helper-role <role>` — Add or remove a helper role\n> **Who:** Admins",
      "`/setup staff-role <role>` — Add or remove a staff role\n> **Who:** Admins",
      "`/setup ticket-category <category>` — Set where ticket channels are created\n> **Who:** Admins",
      "`/setup log-channel <channel>` — Set the ticket log channel\n> **Who:** Admins",
      "`/setup min-messages <count>` — Set minimum messages required to open a ticket\n> **Who:** Admins",
      "`/setup bypass-role <role>` — Add/remove a role that bypasses the message requirement\n> **Who:** Admins",
      "`/setup games <list>` — Set the games shown in the ticket panel\n> **Who:** Admins",
      "`/setup game-category <game> <category>` — Route a game's tickets to a specific category\n> **Who:** Admins",
      "`/setup game-role <game> <role>` — Set the ping role for a specific game's tickets\n> **Who:** Admins",
      "`/setup ping-role <role>` — Set the default role pinged on any new ticket\n> **Who:** Admins",
      "`/setup panel-image <url>` — Set the banner image on the ticket panel\n> **Who:** Admins",
    ].join("\n\n"),
  },
];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("🛠️ Helper Commands")
    .setColor(0x5865f2)
    .setDescription("All commands related to tickets, vouches, profiles, and helper management.")
    .setTimestamp();

  for (const field of FIELDS) {
    embed.addFields({ name: field.name, value: field.value, inline: false });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
