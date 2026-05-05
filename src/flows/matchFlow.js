const { EmbedBuilder } = require("discord.js");
const { appendToGoogleSheet } = require("../lib/googleSheets");
const { findBestPlayerMatch } = require("../lib/playerMatcher");
const formations = require("../data/formations.json");

const activeFlows = new Map();
const matches = new Map();

let matchCounter = 1;

const DUSTY_PURPLE = 0x7B2CFF;

function createDustyEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(DUSTY_PURPLE)
    .setTitle(title)
    .setDescription(description);
}

function getFormationNames() {
  return Object.keys(formations);
}

function getFormationPositions(formation) {
  return formations[formation] || [];
}

function getManagerIds() {
  return (process.env.MANAGER_IDS || "")
    .split(",")
    .map((id) => String(id).trim())
    .filter(Boolean);
}

function getManagerNames() {
  return (process.env.MANAGER_NAMES || "")
    .split(",")
    .map((name) => String(name).trim())
    .filter(Boolean);
}

function isCancelMessage(message) {
  return message.content.trim().toLowerCase() === "cancel";
}

function parseMatchDate(input) {
  const value = input.trim().toLowerCase();
  const today = new Date();

  if (value === "today") {
    return today.toISOString().slice(0, 10);
  }

  if (value === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

async function startMatchFlow(client, user) {
  const formationNames = getFormationNames();

  activeFlows.set(user.id, {
    type: "creator",
    step: "formation_select",
  });

  await user.send({
    embeds: [
      createDustyEmbed(
        "Select the formation",
        [
          ...formationNames.map(
            (formation, index) => `**${index + 1}** ${formation}`
          ),
          "",
          "**Enter a number to select an option**",
          "To exit, type `cancel`.",
        ].join("\n")
      ),
    ],
  });
}

async function handleCreatorMessage(client, message, flow) {
  if (flow.step === "formation_select") {
    const formationNames = getFormationNames();
    const selectedNumber = Number(message.content.trim());

    if (
      !Number.isInteger(selectedNumber) ||
      selectedNumber < 1 ||
      selectedNumber > formationNames.length
    ) {
      await message.author.send({
        embeds: [
          createDustyEmbed(
            "Invalid formation selection",
            [
              "Reply with one of these numbers:",
              "",
              ...formationNames.map(
                (formation, index) => `**${index + 1}** ${formation}`
              ),
              "",
              "To exit, type `cancel`.",
            ].join("\n")
          ),
        ],
      });
      return;
    }

    const formation = formationNames[selectedNumber - 1];
    const positions = getFormationPositions(formation);

    flow.formation = formation;
    flow.positions = positions;
    flow.currentPositionIndex = 0;
    flow.lineup = [];
    flow.step = "match_date";

    activeFlows.set(message.author.id, flow);

    await message.author.send({
      embeds: [
        createDustyEmbed(
          "Enter match date",
          [
            `Formation selected: **${formation}**`,
            "",
            "Reply with the match date.",
            "",
            "Examples:",
            "`today`",
            "`yesterday`",
            "`2026-05-05`",
            "",
            "To exit, type `cancel`.",
          ].join("\n")
        ),
      ],
    });

    return;
  }

  if (flow.step === "match_date") {
    const matchDate = parseMatchDate(message.content);

    if (!matchDate) {
      await message.author.send({
        embeds: [
          createDustyEmbed(
            "Invalid date",
            [
              "Use one of these formats:",
              "`today`",
              "`yesterday`",
              "`YYYY-MM-DD`",
              "",
              "To exit, type `cancel`.",
            ].join("\n")
          ),
        ],
      });
      return;
    }

    flow.matchDate = matchDate;
    flow.step = "lineup_position";

    activeFlows.set(message.author.id, flow);

    await message.author.send({
      embeds: [
        createDustyEmbed(
          `Enter player for ${flow.positions[0]}`,
          [
            `Date: **${matchDate}**`,
            `Formation: **${flow.formation}**`,
            "",
            "Reply with only the player name.",
            "To exit, type `cancel`.",
          ].join("\n")
        ),
      ],
    });

    return;
  }

  if (flow.step === "lineup_position") {
    const position = flow.positions[flow.currentPositionIndex];
    const typedPlayerName = message.content.trim();

    const match = findBestPlayerMatch(typedPlayerName);

    if (!match.ok) {
      const suggestions =
        match.suggestions && match.suggestions.length > 0
          ? `\nSuggestions: ${match.suggestions.join(", ")}`
          : "";

      await message.author.send({
        embeds: [
          createDustyEmbed(
            "Player not found",
            [
              `I could not confidently match **${typedPlayerName}** for **${position}**.`,
              suggestions,
              "",
              "Please send the player name again.",
              "To exit, type `cancel`.",
            ].join("\n")
          ),
        ],
      });
      return;
    }

    flow.lineup.push({
      position,
      player_name: match.matched,
    });

    if (match.confidence === "fuzzy") {
      await message.author.send({
        embeds: [
          createDustyEmbed(
            "Player name corrected",
            `Auto-corrected **${typedPlayerName}** → **${match.matched}**.`
          ),
        ],
      });
    }

    flow.currentPositionIndex += 1;

    if (flow.currentPositionIndex < flow.positions.length) {
      const nextPosition = flow.positions[flow.currentPositionIndex];

      activeFlows.set(message.author.id, flow);

      await message.author.send({
        embeds: [
          createDustyEmbed(
            `Enter player for ${nextPosition}`,
            [
              `Saved **${position}: ${match.matched}**`,
              "",
              "Reply with only the player name.",
              "To exit, type `cancel`.",
            ].join("\n")
          ),
        ],
      });

      return;
    }

    await finishLineupCollection(client, message, flow);
  }
}

async function finishLineupCollection(client, message, flow) {
  const lineup = flow.lineup;
  const matchId = String(matchCounter++);

  matches.set(matchId, {
    matchId,
    matchDate: flow.matchDate,
    createdBy: message.author.id,
    formation: flow.formation,
    lineup,
    ratingsByManager: new Map(),
    createdAt: new Date(),
  });

  const managerIds = getManagerIds();

  if (managerIds.length === 0) {
    await message.author.send({
      embeds: [
        createDustyEmbed(
          "No managers configured",
          "Add `MANAGER_IDS` to your `.env` and restart the bot."
        ),
      ],
    });
    return;
  }

  for (const managerId of managerIds) {
    const managerUser = await client.users.fetch(managerId);

    activeFlows.set(managerId, {
      type: "manager_rating",
      matchId,
      currentRatingIndex: 0,
      ratings: [],
    });

    await managerUser.send({
      embeds: [
        createDustyEmbed(
          `Rate ${lineup[0].position} - ${lineup[0].player_name}`,
          [
            `Date: **${flow.matchDate}**`,
            `Formation: **${flow.formation}**`,
            "",
            "Reply with a whole number from **1** to **10**.",
            "Use `-` if you cannot decide.",
            "No decimals.",
            "To exit, type `cancel`.",
          ].join("\n")
        ),
      ],
    });
  }

  const creatorIsManager = managerIds.includes(String(message.author.id));

  if (!creatorIsManager) {
    activeFlows.delete(message.author.id);
  }

  await message.author.send({
    embeds: [
      createDustyEmbed(
        "Lineup saved",
        [
          `Date: **${flow.matchDate}**`,
          `Formation: **${flow.formation}**`,
          "",
          "```txt",
          ...lineup.map((p) => `${p.position}: ${p.player_name}`),
          "```",
          "",
          `I messaged **${managerIds.length}** managers for ratings.`,
        ].join("\n")
      ),
    ],
  });
}

async function handleManagerRating(client, message, flow) {
  const match = matches.get(flow.matchId);

  if (!match) {
    await message.author.send({
      embeds: [
        createDustyEmbed(
          "Match no longer active",
          "This match is no longer active."
        ),
      ],
    });
    activeFlows.delete(message.author.id);
    return;
  }

  const ratingRaw = message.content.trim();
  let rating;

  if (ratingRaw === "-") {
    rating = "";
  } else {
    if (!/^\d+$/.test(ratingRaw)) {
      await message.author.send({
        embeds: [
          createDustyEmbed(
            "Invalid rating",
            "Send a whole number from **1** to **10**, or `-` if you cannot decide."
          ),
        ],
      });
      return;
    }

    rating = Number(ratingRaw);

    if (rating < 1 || rating > 10) {
      await message.author.send({
        embeds: [
          createDustyEmbed(
            "Invalid rating",
            "Rating must be from **1** to **10**, or `-` if you cannot decide."
          ),
        ],
      });
      return;
    }
  }

  const player = match.lineup[flow.currentRatingIndex];
  const shownRating = rating === "" ? "-" : rating;

  flow.ratings.push({
    position: player.position,
    player_name: player.player_name,
    rating,
  });

  flow.currentRatingIndex += 1;

  if (flow.currentRatingIndex < match.lineup.length) {
    const nextPlayer = match.lineup[flow.currentRatingIndex];

    activeFlows.set(message.author.id, flow);

    await message.author.send({
      embeds: [
        createDustyEmbed(
          `Rate ${nextPlayer.position} - ${nextPlayer.player_name}`,
          [
            `Saved **${player.position} - ${player.player_name}: ${shownRating}**`,
            "",
            "Reply with a whole number from **1** to **10**.",
            "Use `-` if you cannot decide.",
            "No decimals.",
            "To exit, type `cancel`.",
          ].join("\n")
        ),
      ],
    });

    return;
  }

  match.ratingsByManager.set(message.author.id, flow.ratings);
  activeFlows.delete(message.author.id);

  await message.author.send({
    embeds: [
      createDustyEmbed(
        "Ratings saved",
        "Thank you. Your ratings have been submitted."
      ),
    ],
  });

  try {
    await maybePostSummary(client, match.matchId);
  } catch (summaryError) {
    console.error("Summary/Sheet error:", summaryError);

    const safeError =
      summaryError.message.length > 300
        ? summaryError.message.slice(0, 300) + "..."
        : summaryError.message;

    try {
      await message.author.send({
        embeds: [
          createDustyEmbed(
            "Summary or sheet error",
            [
              "Your ratings were saved, but I had a problem creating the summary or writing to the sheet.",
              "",
              `Error: ${safeError}`,
            ].join("\n")
          ),
        ],
      });
    } catch (dmError) {
      console.error("Could not DM summary error:", dmError.message);
    }
  }
}

async function maybePostSummary(client, matchId) {
  const match = matches.get(matchId);
  if (!match) return;

  const managerIds = getManagerIds();
  const managerNames = getManagerNames();

  console.log(
    `Ratings submitted for match ${matchId}: ${match.ratingsByManager.size}/${managerIds.length}`
  );

  if (match.ratingsByManager.size < managerIds.length) {
    return;
  }

  const date = match.matchDate || match.createdAt.toISOString().slice(0, 10);

  const summaryRows = [];
  const rawRows = [];

  for (const player of match.lineup) {
    const ratingsForPlayer = managerIds.map((managerId) => {
      const managerRatings = match.ratingsByManager.get(managerId) || [];
      const found = managerRatings.find((r) => r.position === player.position);
      return found ? found.rating : "";
    });

    const validRatings = ratingsForPlayer
      .filter((rating) => rating !== "" && rating !== "-")
      .map((rating) => Number(rating))
      .filter((rating) => !Number.isNaN(rating));

    const average =
      validRatings.length > 0
        ? validRatings.reduce((sum, rating) => sum + rating, 0) /
          validRatings.length
        : null;

    const managerRatingColumns = ["", "", ""];

    for (let i = 0; i < Math.min(managerIds.length, 3); i++) {
      managerRatingColumns[i] =
        ratingsForPlayer[i] === "" ? "-" : ratingsForPlayer[i];
    }

    summaryRows.push([
      match.matchId,
      date,
      match.formation,
      player.position,
      player.player_name,
      ...managerRatingColumns,
      average === null ? "-" : average.toFixed(1),
    ]);

    managerIds.forEach((managerId, index) => {
      rawRows.push([
        match.matchId,
        date,
        match.formation,
        player.position,
        player.player_name,
        managerId,
        managerNames[index] || `Manager ${index + 1}`,
        ratingsForPlayer[index] === "" ? "-" : ratingsForPlayer[index],
      ]);
    });
  }

  await appendToGoogleSheet(summaryRows, rawRows);

  const summaryLines = summaryRows.map((row) => {
    const position = row[3];
    const player = row[4];
    const average = row[row.length - 1];

    return `${position} - ${player}: ${average}`;
  });

  const channel = await client.channels.fetch(process.env.RESULT_CHANNEL_ID);

  const header = [
    "# Match Ratings Summary",
    "",
    `Match ID: **${match.matchId}**`,
    `Date: **${date}**`,
    `Formation: **${match.formation}**`,
    "",
  ].join("\n");

  const body = ["```txt", ...summaryLines, "```"].join("\n");
  const footer = "\nSaved to Google Sheets.";
  const fullMessage = `${header}${body}${footer}`;

  if (fullMessage.length <= 1900) {
    await channel.send(fullMessage);
  } else {
    await channel.send(header);

    const chunks = [];
    let currentChunk = "";

    for (const line of summaryLines) {
      const nextChunk = currentChunk ? `${currentChunk}\n${line}` : line;

      if (nextChunk.length > 1700) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk = nextChunk;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    for (const chunk of chunks) {
      await channel.send(["```txt", chunk, "```"].join("\n"));
    }

    await channel.send("Saved to Google Sheets.");
  }

  matches.delete(matchId);
}

async function handleDmMessage(client, message) {
  if (isCancelMessage(message)) {
    activeFlows.delete(message.author.id);

    await message.author.send({
      embeds: [
        createDustyEmbed(
          "Flow cancelled",
          "Your active match/rating flow has been cancelled."
        ),
      ],
    });

    return;
  }

  const flow = activeFlows.get(message.author.id);

  if (!flow) {
    console.log("No active flow for DM user:", message.author.id);
    return;
  }

  if (flow.type === "creator") {
    await handleCreatorMessage(client, message, flow);
    return;
  }

  if (flow.type === "manager_rating") {
    await handleManagerRating(client, message, flow);
  }
}

module.exports = {
  startMatchFlow,
  handleDmMessage,
};