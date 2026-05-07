const { EmbedBuilder } = require("discord.js");
const { appendReplacementToGoogleSheet } = require("../lib/googleSheets");
const { replacePendingLineupPlayer } = require("./matchFlow");

const DUSTY_PURPLE = 0x7B2CFF;

function createEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(DUSTY_PURPLE)
    .setTitle(title)
    .setDescription(description);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function handleReplaceCommand(interaction) {
  const player = interaction.options.getString("player", true).trim();
  const replacement = interaction.options.getString("replacement", true).trim();
  const reason = interaction.options.getString("reason", true).trim();

  await interaction.deferReply({ ephemeral: true });

  const result = await replacePendingLineupPlayer(
    interaction.user.id,
    player,
    replacement
  );

  if (!result.ok) {
    await interaction.editReply({
      embeds: [createEmbed("Replacement failed", result.error)],
    });
    return;
  }

  const date = result.matchDate || getTodayDate();

  const replacementRows = [[
    date,
    result.oldPlayer,
    reason,
    interaction.user.username,
    "discord",
    result.newPlayer,
    result.position,
  ]];

  await appendReplacementToGoogleSheet(replacementRows);

  await interaction.editReply({
    embeds: [
      createEmbed(
        "Replacement logged",
        [
          `Date: **${date}**`,
          `Position: **${result.position}**`,
          `Out: **${result.oldPlayer}**`,
          `In: **${result.newPlayer}**`,
          `Reason: **${reason}**`,
          "",
          "Pending lineup updated.",
          "",
          "```txt",
          ...result.lineup.map((p) => `${p.position}: ${p.player_name}`),
          "```",
        ].join("\n")
      ),
    ],
  });
}

module.exports = {
  handleReplaceCommand,
};