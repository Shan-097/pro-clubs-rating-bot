const { EmbedBuilder } = require("discord.js");
const { appendAvailabilityToGoogleSheet } = require("../lib/googleSheets");
const allPlayers = require("../data/players.json");


const DUSTY_PURPLE = 0x7B2CFF;

function createEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(DUSTY_PURPLE)
    .setTitle(title)
    .setDescription(description);
}

function parseDiscordMessageLink(link) {
  const match = link.match(/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
  if (!match) return null;

  return {
    guildId: match[1],
    channelId: match[2],
    messageId: match[3],
  };
}

function normalizeName(name) {
  return String(name || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase();
}

function cleanApolloName(line) {
  return String(line || "")
    .replace(/^[✅❌❔🔔\s]+/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim();
}

function extractNamesFromField(fieldValue) {
  return String(fieldValue || "")
    .split("\n")
    .map(cleanApolloName)
    .filter(Boolean);
}

function getEmbedText(embed) {
  const parts = [];

  if (embed.title) parts.push(embed.title);
  if (embed.description) parts.push(embed.description);

  for (const field of embed.fields || []) {
    parts.push(field.name || "");
    parts.push(field.value || "");
  }

  return parts.join("\n");
}

function parseEventDate(embed) {
  const text = getEmbedText(embed);

  const dateMatch = text.match(/(\d{1,2}\s+\w+\s+\d{4})/);
  if (dateMatch) return dateMatch[1];

  return new Date().toISOString().slice(0, 10);
}

function parseApolloAvailability(embed) {
  const accepted = [];
  const declined = [];

  for (const field of embed.fields || []) {
    const fieldName = String(field.name || "").toLowerCase();

    if (fieldName.includes("accepted")) {
      accepted.push(...extractNamesFromField(field.value));
    }

    if (fieldName.includes("declined")) {
      declined.push(...extractNamesFromField(field.value));
    }
  }

  return {
    accepted,
    declined,
    eventTitle: embed.title || "Availability Event",
    eventDate: parseEventDate(embed),
  };
}

function parseCsvNames(text) {
  return String(text || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function toNameSet(names) {
  return new Set(names.map(normalizeName).filter(Boolean));
}

async function handleAvailabilityCommand(interaction) {
  const messageLink = interaction.options.getString("message_link", true);
  const selectedPlayersText = interaction.options.getString("selected", false) || "";

  await interaction.deferReply({ ephemeral: true });

  const parsedLink = parseDiscordMessageLink(messageLink);

  if (!parsedLink) {
    await interaction.editReply("Invalid Discord message link.");
    return;
  }

  const channel = await interaction.client.channels.fetch(parsedLink.channelId);
  const apolloMessage = await channel.messages.fetch(parsedLink.messageId);

  const embed = apolloMessage.embeds?.[0];

  if (!embed) {
    await interaction.editReply("I could not find an embed on that Apollo message.");
    return;
  }

  const { accepted, declined, eventTitle, eventDate } = parseApolloAvailability(embed);

 
  const selectedPlayers = parseCsvNames(selectedPlayersText);

  const acceptedSet = toNameSet(accepted);
  const declinedSet = toNameSet(declined);
  const selectedSet = toNameSet(selectedPlayers);

  const availabilityRows = allPlayers.map((player) => {
    const key = normalizeName(player);

    let status = "No Response";

    if (acceptedSet.has(key)) status = "Accepted";
    if (declinedSet.has(key)) status = "Declined";

    const selected = selectedSet.has(key) ? "Yes" : "No";
    const acceptedButNotSelected = status === "Accepted" && selected === "No" ? "Yes" : "No";

    return [
      parsedLink.messageId,
      eventDate,
      eventTitle,
      player,
      status,
      selected,
      acceptedButNotSelected,
      messageLink,
    ];
  });

  await appendAvailabilityToGoogleSheet(availabilityRows);

  const acceptedCount = availabilityRows.filter((row) => row[4] === "Accepted").length;
  const declinedCount = availabilityRows.filter((row) => row[4] === "Declined").length;
  const noResponseCount = availabilityRows.filter((row) => row[4] === "No Response").length;
  const acceptedNotSelectedCount = availabilityRows.filter((row) => row[6] === "Yes").length;

  await interaction.editReply({
    embeds: [
      createEmbed(
        "Availability saved",
        [
          `Event: **${eventTitle}**`,
          `Date: **${eventDate}**`,
          "",
          `Accepted: **${acceptedCount}**`,
          `Declined: **${declinedCount}**`,
          `No Response: **${noResponseCount}**`,
          `Accepted but not selected: **${acceptedNotSelectedCount}**`,
          "",
          "Saved to Google Sheets.",
        ].join("\n")
      ),
    ],
  });
}

module.exports = {
  handleAvailabilityCommand,
};