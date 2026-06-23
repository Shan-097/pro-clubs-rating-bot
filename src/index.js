require("dotenv").config();

console.log("Loaded managers:", process.env.MANAGER_IDS);
console.log("Loaded manager names:", process.env.MANAGER_NAMES);

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} = require("discord.js");

const { handleAvailabilityCommand } = require("./flows/availabilityFlow");
const { handleReplaceCommand } = require("./flows/replacementFlow");
const { startEaMatchWatcher } = require("./services/eaMatchWatcher");

const {
  startLineupFlow,
  startMatchRatings,
  handleDmMessage,
} = require("./flows/matchFlow");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
  startEaMatchWatcher(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "lineup") {
    await interaction.reply({
      content: "I sent you a DM to build the pending lineup.",
      ephemeral: true,
    });

    await startLineupFlow(client, interaction.user);
    return;
  }

  if (interaction.commandName === "match") {
    await startMatchRatings(client, interaction);
    return;
  }

  if (interaction.commandName === "replace") {
    await handleReplaceCommand(interaction);
    return;
  }

  if (interaction.commandName === "availability") {
    await handleAvailabilityCommand(interaction);
    return;
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.guild) return;

  await handleDmMessage(client, message);
});

client.login(process.env.DISCORD_TOKEN);
