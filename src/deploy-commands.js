require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("match")
    .setDescription("Start a new match rating flow.")
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
    .addStringOption((option) =>
      option
        .setName("players")
        .setDescription("Full player list, comma separated.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("selected")
        .setDescription("Selected lineup players, comma separated.")
        .setRequired(false)
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