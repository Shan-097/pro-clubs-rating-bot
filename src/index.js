require("dotenv").config();
console.log("Loaded managers:", process.env.MANAGER_IDS);
console.log("Loaded manager names:", process.env.MANAGER_NAMES);

const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder
} = require("discord.js");

const {
  startMatchFlow,
  handleDmMessage,
} = require("./flows/matchFlow");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "match") {
    await interaction.reply({
      content: "I sent you a DM to start the match rating flow.",
      ephemeral: true,
    });

    await startMatchFlow(client, interaction.user);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.guild) return;

  await handleDmMessage(client, message);
});

client.login(process.env.DISCORD_TOKEN);