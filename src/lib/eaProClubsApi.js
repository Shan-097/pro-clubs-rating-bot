const DEFAULT_BASE_URL = `https://${["proclubs", "ea", "com"].join(".")}/api/fc`;
const DEFAULT_MATCH_TYPES = ["leagueMatch", "friendlyMatch"];

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;

  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }

  const normalizedMap = new Map(
    Object.entries(obj).map(([key, value]) => [normalizeKey(key), value])
  );

  for (const key of keys) {
    const value = normalizedMap.get(normalizeKey(key));
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

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function cleanPositionValue(value) {
  const normalized = String(value || "").trim();
  const map = {
    gk: "Goalkeeper",
    goalkeeper: "Goalkeeper",
    def: "Defender",
    defender: "Defender",
    mid: "Midfielder",
    midfielder: "Midfielder",
    fwd: "Forward",
    forward: "Forward",
  };
  return map[normalized.toLowerCase()] || titleCase(normalized);
}

function formatPosition(player) {
  const base = cleanPositionValue(
    pick(player, ["positionFull", "positionName", "posName", "proPos", "position", "pos"])
  );
  const archetypeRaw = pick(player, ["archetype", "archetypeName", "className", "build", "roleName", "playStyle"]);
  const archetype = titleCase(archetypeRaw);

  if (!base) return archetype || "Unknown";
  if (!archetype || normalizeKey(archetype) === normalizeKey(base)) return base;
  if (normalizeKey(base).includes(normalizeKey(archetype))) return base;
  return `${base}: ${archetype}`;
}

function getConfiguredMatchTypes() {
  return (process.env.EA_MATCH_TYPES || DEFAULT_MATCH_TYPES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function fetchRecentClubMatches({ clubId, platform, matchTypes }) {
  const allMatches = [];
  const baseUrl = (process.env.EA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const selectedTypes = matchTypes?.length ? matchTypes : getConfiguredMatchTypes();

  for (const matchType of selectedTypes) {
    const url = new URL(`${baseUrl}/clubs/matches`);
    url.searchParams.set("matchType", matchType);
    url.searchParams.set("platform", platform);
    url.searchParams.set("club" + "Ids", clubId);

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await response.text();
    if (!response.ok) throw new Error(`EA API error ${response.status}: ${text.slice(0, 250)}`);

    const data = JSON.parse(text);
    const matches = Array.isArray(data) ? data : data.matches || data.data || Object.values(data || {});
    allMatches.push(...matches.filter(Boolean).map((match) => ({ ...match, _eaMatchType: matchType })));
  }

  return allMatches;
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

function clubLogoUrl(club, id) {
  return String(
    process.env[`EA_LOGO_URL_${id}`] ||
      pick(club?.details, ["logoUrl", "crestUrl", "crestURL", "clubLogoUrl", "badgeUrl", "teamLogoUrl", "imageUrl"]) ||
      pick(club, ["logoUrl", "crestUrl", "crestURL", "clubLogoUrl", "badgeUrl", "teamLogoUrl", "imageUrl"]) ||
      ""
  );
}

function timestampMs(match) {
  const raw = pick(match, ["timestamp", "date", "playedAt", "matchTime"]);
  if (!raw) return null;
  if (/^\d+$/.test(String(raw))) return Number(raw) > 10_000_000_000 ? Number(raw) : Number(raw) * 1000;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizePlayer(player) {
  const madePasses = num(pick(player, ["passesmade", "passesMade", "passmade", "passMade", "completedPasses", "passesCompleted", "pm"]), 0);
  const passAttempts = num(pick(player, ["passatt", "passAtt", "passattempts", "passAttempts", "passesatt", "passesAtt", "passesattempted", "passesAttempted", "passesattempts", "passesAttempts", "totalpasses", "totalPasses", "passes", "pa"]), 0);
  const madeTackles = num(pick(player, ["tacklesmade", "tacklesMade", "tacklemade", "tackleMade", "successfulTackles", "tm"]), 0);
  const tackleAttempts = num(pick(player, ["tackleatt", "tackleAtt", "tackleattempts", "tackleAttempts", "tacklesatt", "tacklesAtt", "tacklesattempted", "tacklesAttempted", "tacklesattempts", "tacklesAttempts", "totaltackles", "totalTackles", "tackles", "ta"]), 0);
  const rating = pick(player, ["rating", "matchRating", "avgRating", "rat"]);

  return {
    player: String(pick(player, ["playername", "playerName", "personaName", "name", "gamertag", "displayName", "_key"]) || "Unknown Player"),
    position: formatPosition(player),
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
  if (value.includes("friendly")) return "Friendly";
  if (value.includes("league")) return "League";
  return "Match";
}

function normalizeEaMatch(match, wantedClubId) {
  const clubEntries = Object.entries(match.clubs || match.clubsInfo || match.clubInfo || {});
  const ourEntry = clubEntries.find(([key, club]) => clubId(key, club) === String(wantedClubId));
  const opponentEntry = clubEntries.find(([key]) => key !== ourEntry?.[0]);
  if (!ourEntry || !opponentEntry) return null;

  const [ourKey, ourClub] = ourEntry;
  const [opponentKey, opponentClub] = opponentEntry;
  const ourClubId = clubId(ourKey, ourClub);
  const opponentClubId = clubId(opponentKey, opponentClub);
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
    leftTeam: { clubId: opponentClubId, name: clubName(opponentClub, "Opponent"), goals: clubGoals(opponentClub), logoUrl: clubLogoUrl(opponentClub, opponentClubId) },
    rightTeam: { clubId: ourClubId, name: clubName(ourClub, process.env.EA_CLUB_NAME || "Dusty Dynamos"), goals: clubGoals(ourClub), logoUrl: clubLogoUrl(ourClub, ourClubId) },
    trackedClubName: clubName(ourClub, process.env.EA_CLUB_NAME || "Dusty Dynamos"),
    trackedPlayers: rows.length,
    rows,
  };
}

module.exports = { fetchRecentClubMatches, getConfiguredMatchTypes, normalizeEaMatch };