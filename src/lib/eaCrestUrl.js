const DEFAULT_CREST_BASE_URL = "https://eafc24.content.easports.com/fifa/fltOnlineAssets/24B23FDE-7835-41C2-87A2-F453DFDB2E82/2024/fcweb/crests/256x256";

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

function looksLikeCrestKey(key) {
  const normalized = normalizeKey(key);
  return (
    normalized.includes("crest") ||
    normalized.includes("badge") ||
    normalized.includes("logo") ||
    normalized === "assetid"
  );
}

function walkObject(value, visitor, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return undefined;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    const result = visitor(key, child);
    if (result !== undefined && result !== null && result !== "") return result;

    if (child && typeof child === "object") {
      const nested = walkObject(child, visitor, seen);
      if (nested !== undefined && nested !== null && nested !== "") return nested;
    }
  }

  return undefined;
}

function normalizeTeamCrestId(value) {
  if (!/^\d+$/.test(String(value))) return "";
  const id = Number(value);

  if (!Number.isFinite(id)) return "";
  if (id > 0 && id < 1000) return String(id + 100);
  return String(value);
}

function findCrestId(club) {
  const teamValue = pick(club, ["TEAM", "team", "teamId"]) || pick(club?.details, ["TEAM", "team", "teamId"]);
  const fromTeam = normalizeTeamCrestId(teamValue);
  if (fromTeam) return fromTeam;

  const customKit = club?.details?.customKit || club?.customKit || {};
  const fromCustomKit = pick(customKit, ["crestAssetId", "crestId", "crest", "badgeId", "logoId"]);
  if (fromCustomKit && /^\d+$/.test(String(fromCustomKit))) return String(fromCustomKit);

  const direct = pick(club, [
    "crestAssetId",
    "crestId",
    "crestID",
    "crest",
    "customCrest",
    "assetId",
    "badgeId",
    "logoId",
  ]);

  if (direct && /^\d+$/.test(String(direct))) return String(direct);

  const details = club?.details;
  const fromDetails = pick(details, [
    "crestAssetId",
    "crestId",
    "crestID",
    "crest",
    "customCrest",
    "assetId",
    "badgeId",
    "logoId",
  ]);

  if (fromDetails && /^\d+$/.test(String(fromDetails))) return String(fromDetails);

  const recursive = walkObject(club, (key, value) => {
    if (!looksLikeCrestKey(key)) return undefined;
    if (/^\d+$/.test(String(value))) return String(value);
    return undefined;
  });

  return recursive || "";
}

function findExplicitUrl(club) {
  const explicit =
    pick(club?.details, [
      "logoUrl",
      "crestUrl",
      "crestURL",
      "clubLogoUrl",
      "badgeUrl",
      "teamLogoUrl",
      "imageUrl",
      "logo",
      "crestImageUrl",
    ]) ||
    pick(club, [
      "logoUrl",
      "crestUrl",
      "crestURL",
      "clubLogoUrl",
      "badgeUrl",
      "teamLogoUrl",
      "imageUrl",
      "logo",
      "crestImageUrl",
    ]);

  if (explicit && /^https?:\/\//i.test(String(explicit))) return String(explicit);

  const recursive = walkObject(club, (key, value) => {
    if (!looksLikeCrestKey(key)) return undefined;
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
    return undefined;
  });

  return recursive || "";
}

function crestUrlFromClub(club) {
  const explicit = findExplicitUrl(club);
  if (explicit) return explicit;

  const crestId = findCrestId(club);
  if (!crestId) return "";

  const baseUrl = (process.env.EA_CREST_BASE_URL || DEFAULT_CREST_BASE_URL).replace(/\/$/, "");
  return `${baseUrl}/${crestId}.png`;
}

module.exports = {
  crestUrlFromClub,
  findCrestId,
};
