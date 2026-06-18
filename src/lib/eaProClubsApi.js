const DEFAULT_BASE_URL = `https://${["proclubs", "ea", "com"].join(".")}/api/fc`;
const DEFAULT_MATCH_TYPES = ["gameType9", "gameType13"];

function pick(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function items(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "object") return [];
  return Object.entries(value).map(([key, item]) => ({ ...(item || {}), _key: key }));
}

function getConfiguredMatchTypes() {
  return (process.env.EA_MATCH_TYPES || DEFAULT_MATCH_TYPES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function fetchRecentClubMatches({ clubId, platform }) {
  const baseUrl = (process.env.EA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = new URL(`${baseUrl}/clubs/matches`);
  url.searchParams.set("platform", platform);
  url.searchParams.set("club" + "Ids", clubId);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await response.text();
  if (!response.ok) throw new Error(`EA API error ${response.status}: ${text.slice(0, 250)}`);

  const data = JSON.parse(text);
  const matches = Array.isArray(data) ? data : data.matches || data.data || Object.values(data || {});
  return matches.filter(Boolean).map((match) => ({
    ...match,
    _eaMatchType: String(pick(match, ["matchType", "gameType", "type", "cupName", "competition"]) || ""),
  }));
}

function clubId(key, club) {
  return String(pick(club, ["clubId", "id"]) || pick(club?.details, ["clubId", "id"]) || key || "");
}

function clubName(club, fallback) {
  return String(pick(club?.details, ["name", "clubName"]) || pick(club, ["name", "clubName", "teamName"]) || fallback);
}

function clubGoals(club) {
  return num(pick(club, ["goals", "score", "clubGoals", "goalsFor"]), 0);
}

function timestampMs(match) {
  const raw = pick(match, ["timestamp", "date", "playedAt", "matchTime"]);
  if (!raw) return null;
  if (/^\d+$/.test(String(raw))) return Number(raw) > 10_000_000_000 ? Number(raw) : Number(raw) * 1000;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizePlayer(player) {
  const madePasses = num(pick(player, ["passesmade", "passesMade", "passmade", "pm"]), 0);
  const passAttempts = num(pick(player, ["passatt", "passesAttempted", "passesatt", "pa"]), 0);
  const madeTackles = num(pick(player, ["tacklesmade", "tacklesMade", "tacklemade", "tm"]), 0);
  const tackleAttempts = num(pick(player, ["tackleatt", "tacklesAttempted", "tacklesatt", "ta"]), 0);
  const rating = pick(player, ["rating", "matchRating", "avgRating", "rat"]);

  return {
    player: String(pick(player, ["playername", "playerName", "personaName", "name", "gamertag", "displayName", "_key"]) || "Unknown Player"),
    position: String(pick(player, ["positionFull", "positionName", "posName", "proPos", "position", "pos", "className", "archetype"]) || "Unknown"),
    rating: rating === undefined ? null : num(rating, null),
    goals: num(pick(player, ["gls", "goals"]), 0),
    shots: num(pick(player, ["shots", "sht", "totalShots"]), 0),
    assists: num(pick(player, ["ast", "assists"]), 0),
    passesMade: madePasses,
    passesAttempted: passAttempts,
    tacklesMade: madeTackles,
    tacklesAttempted: tackleAttempts,
    saves: num(pick(player, ["saves", "svs"]), 0),
    motm: [true, 1, "1", "true"].includes(pick(player, ["mom", "motm", "manOfTheMatch"])),
  };
}

function competitionName(match, rawType) {
  const value = String(rawType || pick(match, ["matchType", "gameType", "type", "cupName", "competition"]) || "").toLowerCase();
  if (value.includes("friendly") || value.includes("13")) return "Friendly";
  if (value.includes("league") || value.includes("9")) return "League";
  return "Match";
}

function normalizeEaMatch(match, wantedClubId) {
  const clubEntries = Object.entries(match.clubs || match.clubsInfo || match.clubInfo || {});
  const ourEntry = clubEntries.find(([key, club]) => clubId(key, club) === String(wantedClubId));
  const opponentEntry = clubEntries.find(([key]) => key !== ourEntry?.[0]);
  if (!ourEntry || !opponentEntry) return null;

  const [ourKey, ourClub] = ourEntry;
  const [opponentKey, opponentClub] = opponentEntry;
  const root = match.players || match.playerStats || {};
  const rows = items(root[ourKey] || root[String(wantedClubId)] || ourClub.players || ourClub.playerStats)
    .map(normalizePlayer)
    .filter((row) => row.player !== "Unknown Player")
    .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  if (rows[0] && !rows.some((row) => row.motm) && rows[0].rating !== null) rows[0].motm = true;

  const ts = timestampMs(match);
  const rawType = match._eaMatchType;
  const matchId = String(pick(match, ["matchId", "id", "gameId", "fixtureId"]) || [ts || "time", opponentKey, ourKey, clubGoals(opponentClub), clubGoals(ourClub)].join("-"));

  return {
    matchId,
    competition: competitionName(match, rawType),
    matchType: rawType,
    playedAt: ts ? new Date(ts).toISOString() : null,
    timestampMs: ts,
    minutesPlayed: num(pick(match, ["minutesPlayed", "gameTime", "matchLength"]), 90),
    gameNumber: pick(ourClub, ["gameNumber", "matchNumber"]),
    leftTeam: { clubId: clubId(opponentKey, opponentClub), name: clubName(opponentClub, "Opponent"), goals: clubGoals(opponentClub) },
    rightTeam: { clubId: clubId(ourKey, ourClub), name: clubName(ourClub, process.env.EA_CLUB_NAME || "Dusty Dynamos"), goals: clubGoals(ourClub) },
    trackedClubName: clubName(ourClub, process.env.EA_CLUB_NAME || "Dusty Dynamos"),
    trackedPlayers: rows.length,
    rows,
  };
}

module.exports = { fetchRecentClubMatches, getConfiguredMatchTypes, normalizeEaMatch };
