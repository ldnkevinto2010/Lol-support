import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { GuildConfig } from "../models/GuildConfig";

const DEFAULT_QUESTIONS = [
  { label: "Can you solo most content in the game?", placeholder: "Yes / No and details", style: "paragraph" },
  { label: "What can't you solo?", placeholder: "List any content you struggle with", style: "short" },
  { label: "What level are you?", placeholder: "e.g. Level 150", style: "short" },
  { label: "What's your team?", placeholder: "List your main units", style: "short" },
  { label: "How many hours per day can you help?", placeholder: "e.g. 3-5 hours", style: "short" },
];

export const data = new SlashCommandBuilder()
  .setName("appquestions")
  .setDescription("Customize the application questions shown for each game")
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Set a question for a specific slot (1–5) for a game")
      .addStringOption((opt) =>
        opt.setName("game").setDescription("Game name (must match exactly)").setRequired(true).setMaxLength(100)
      )
      .addIntegerOption((opt) =>
        opt.setName("slot").setDescription("Question slot (1–5)").setRequired(true).setMinValue(1).setMaxValue(5)
      )
      .addStringOption((opt) =>
        opt.setName("label").setDescription("The question text shown to the applicant").setRequired(true).setMaxLength(45)
      )
      .addStringOption((opt) =>
        opt.setName("placeholder").setDescription("Hint text shown inside the answer box").setRequired(false).setMaxLength(100)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View the current questions for a game")
      .addStringOption((opt) =>
        opt.setName("game").setDescription("Game name").setRequired(true).setMaxLength(100)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("clear")
      .setDescription("Remove all custom questions for a game (reverts to defaults)")
      .addStringOption((opt) =>
        opt.setName("game").setDescription("Game name").setRequired(true).setMaxLength(100)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    return;
  }

  const isAdmin = (interaction.member as any)?.permissions?.has(BigInt(8));
  if (!isAdmin) {
    await interaction.reply({ content: "❌ Only admins can manage application questions.", ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const game = interaction.options.getString("game", true).trim();

  const config = await GuildConfig.findOneAndUpdate(
    { guildId: interaction.guildId },
    {},
    { upsert: true, new: true }
  );

  const entryIdx = (config.applicationQuestions ?? []).findIndex(
    (aq) => aq.game.toLowerCase() === game.toLowerCase()
  );

  if (sub === "set") {
    const slot = interaction.options.getInteger("slot", true) - 1;
    const label = interaction.options.getString("label", true).trim();
    const placeholder = interaction.options.getString("placeholder")?.trim() ?? "";
    const style: "paragraph" = "paragraph";

    if (entryIdx === -1) {
      const questions = DEFAULT_QUESTIONS.map((q) => ({ ...q })) as { label: string; placeholder: string; style: "short" | "paragraph" }[];
      questions[slot] = { label, placeholder, style };
      config.applicationQuestions.push({ game, questions });
    } else {
      const questions = [...config.applicationQuestions[entryIdx].questions];
      while (questions.length < 5) questions.push({ label: DEFAULT_QUESTIONS[questions.length].label, placeholder: DEFAULT_QUESTIONS[questions.length].placeholder, style: DEFAULT_QUESTIONS[questions.length].style as "short" | "paragraph" });
      questions[slot] = { label, placeholder, style };
      config.applicationQuestions[entryIdx].questions = questions;
    }

    await config.save();
    await interaction.reply({
      content: `✅ Question ${slot + 1} for **${game}** set to: **${label}**`,
      ephemeral: true,
    });

  } else if (sub === "view") {
    const entry = entryIdx !== -1 ? config.applicationQuestions[entryIdx] : null;
    const questions = entry?.questions?.length ? entry.questions : DEFAULT_QUESTIONS;
    const isCustom = !!entry?.questions?.length;

    const embed = new EmbedBuilder()
      .setTitle(`📋 Application Questions — ${game}`)
      .setColor(0xe91e8c)
      .setDescription(isCustom ? "Using **custom** questions." : "Using **default** questions (no custom set).")
      .setTimestamp();

    questions.forEach((q, i) => {
      embed.addFields({
        name: `Q${i + 1}. ${q.label}`,
        value: q.placeholder ? `Placeholder: *${q.placeholder}*` : "*No placeholder*",
      });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (sub === "clear") {
    if (entryIdx !== -1) {
      config.applicationQuestions.splice(entryIdx, 1);
      await config.save();
    }
    await interaction.reply({
      content: `✅ Custom questions for **${game}** cleared — reverted to defaults.`,
      ephemeral: true,
    });
  }
}
