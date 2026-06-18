const cron = require("node-cron");
const { AttachmentBuilder } = require("discord.js");
const {
  fetchRecentClubMatches,
  getConfiguredMatchTypes,
  normalizeEaMatch,
} = require("../lib/eaProClubsApi");
const { renderMatchStatsImage } = require("../lib/matchStatsImage");
const { hasPostedMatch, markMatchPosted } = require("../lib/postedMatchesStore");

const DEFAULT_CRON = "*/5 * * * *";
let isChecking = false;

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shouldPostMatch(match) {
  if (!match?.matchId) return false;
  if (!Array.isArray(match.rows) || match.rows.length === 0) return false;

  const lookbackMinutes = numberEnv("EA_POST_LOOKBACK_MINUTES", 180);
  if (!match.timestampMs || lookbackMinutes <= 0) return true;

  return match.timestampMs >= Date.now() - lookbackMinutes * 60 * 1000;
}

async function sendStatsImage(channel, match) {
  const image = await renderMatchStatsImage(match);
  const safeMatchId = String(match.matchId).replace(/[^a-z0-9_-]/gi, "_");
  const file = new AttachmentBuilder(image, {
    name: `dusty-dynamos-stats-${safeMatchId}.png`,
  });

  return channel.send({
    content: `${match.competition} stats: **${match.leftTeam.name} ${match.leftTeam.goals}-${match.rightTeam.goals} ${match.rightTeam.name}**`,
    files: [file],
  });
}

async function checkAndPostRecentEaMatches(client) {
  if (isChecking) return;
  isChecking = true;

  try {
    const statsChannelId = process.env.STATS_CHANNEL_ID;
    const clubId = process.env.EA_CLUB_ID;
    const platform = process.env.EA_PLATFORM || "common-gen5";

    if (!statsChannelId) {
      console.warn("EA watcher disabled: missing STATS_CHANNEL_ID.");
      return;
    }

    if (!clubId) {
      console.warn("EA watcher disabled: missing EA_CLUB_ID.");
      return;
    }

    const rawMatches = await fetchRecentClubMatches({
      clubId,
      platform,
      matchTypes: getConfiguredMatchTypes(),
    });

    const matches = rawMatches
      .map((match) => normalizeEaMatch(match, clubId))
      .filter(shouldPostMatch)
      .sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));

    const maxPosts = numberEnv("EA_MAX_POSTS_PER_CHECK", 3);
    const channel = await client.channels.fetch(statsChannelId);

    if (!channel || typeof channel.send !== "function") {
      throw new Error(`Stats channel ${statsChannelId} is not sendable.`);
    }

    let postedCount = 0;

    for (const match of matches) {
      if (postedCount >= maxPosts) break;
      if (await hasPostedMatch(match.matchId)) continue;

      const message = await sendStatsImage(channel, match);
      await markMatchPosted({
        matchId: match.matchId,
        competition: match.competition,
        matchType: match.matchType,
        playedAt: match.playedAt,
        leftTeam: match.leftTeam.name,
        rightTeam: match.rightTeam.name,
        score: `${match.leftTeam.goals}-${match.rightTeam.goals}`,
        channelId: statsChannelId,
        messageId: message.id,
      });

      postedCount += 1;
      console.log(`Posted EA stats image for match ${match.matchId}.`);
    }

    if (postedCount === 0) {
      console.log("EA watcher checked recent matches. Nothing new to post.");
    }
  } catch (error) {
    console.error("EA watcher error:", error);
  } finally {
    isChecking = false;
  }
}

function startEaMatchWatcher(client) {
  const expression = process.env.EA_POLL_CRON || DEFAULT_CRON;

  if (!cron.validate(expression)) {
    console.warn(`Invalid EA_POLL_CRON "${expression}". EA watcher not started.`);
    return;
  }

  cron.schedule(expression, () => checkAndPostRecentEaMatches(client));
  console.log(`EA match watcher started with cron: ${expression}`);

  setTimeout(
    () => checkAndPostRecentEaMatches(client),
    numberEnv("EA_STARTUP_DELAY_MS", 15_000)
  );
}

module.exports = {
  checkAndPostRecentEaMatches,
  startEaMatchWatcher,
};
