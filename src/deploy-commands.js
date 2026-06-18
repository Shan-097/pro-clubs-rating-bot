require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("lineup")
    .setDescription("Create a pending lineup before ratings.")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("match")
    .setDescription("Start ratings for the pending lineup.")
    .addBooleanOption((option) =>
      option
        .setName("ecp")
        .setDescription("Request ratings from ECP for this match.")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("rob")
        .setDescription("Request ratings from Rob for this match.")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("birdie")
        .setDescription("Request ratings from Birdie for this match.")
        .setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("replace")
    .setDescription("Replace a player in the pending lineup.")
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription("The player who pulled out.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("replacement")
        .setDescription("The replacement player coming in.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the replacement.")
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName("availability")
    .setDescription("Read Apollo availability and send it to Google Sheets.")
    .addStringOption((option) =>
      option
        .setName("message_link")
        .setDescription("Discord message link to the Apollo event message.")
        .setRequired(true)
    )
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

async function main() {
  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );

    console.log("Slash commands registered.");
  } catch (error) {
    console.error(error);
  }
}

main();
