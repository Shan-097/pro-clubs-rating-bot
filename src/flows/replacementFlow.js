const { EmbedBuilder } = require("discord.js");
const { appendReplacementToGoogleSheet } = require("../lib/googleSheets");

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
  const reason = interaction.options.getString("reason", true).trim();

  await interaction.deferReply({ ephemeral: true });

  const date = getTodayDate();

  const replacementRows = [[
    date,
    player,
    reason,
    interaction.user.username,
    "discord",
  ]];

  await appendReplacementToGoogleSheet(replacementRows);

  await interaction.editReply({
    embeds: [
      createEmbed(
        "Replacement logged",
        [
          `Player: **${player}**`,
          `Date: **${date}**`,
          `Reason: **${reason}**`,
          "",
          "Saved to Google Sheets.",
        ].join("\n")
      ),
    ],
  });
}

module.exports = {
  handleReplaceCommand,
};