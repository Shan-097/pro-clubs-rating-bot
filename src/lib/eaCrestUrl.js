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
  const normalizedMap = new Map(Object.entries(obj).map(([key, value]) => [normalizeKey(key), value]));
  for (const key of keys) {
    const value = normalizedMap.get(normalizeKey(key));
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function looksLikeCrestKey(key) {
  const normalized = normalizeKey(key);
  return normalized.includes("crest") || normalized.includes("badge") || normalized.includes("logo") || normalized === "assetid";
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

function addUnique(array, value) {
  if (value === undefined || value === null || value === "") return;
  const stringValue = String(value);
  if (!array.includes(stringValue)) array.push(stringValue);
}

function crestBaseUrl() {
  return (process.env.EA_CREST_BASE_URL || DEFAULT_CREST_BASE_URL).replace(/\/$/, "");
}

function crestUrlForId(id) {
  if (!/^\d+$/.test(String(id))) return "";
  return `${crestBaseUrl()}/${id}.png`;
}

function normalizeOfficialTeamCrestId(value) {
  if (!/^\d+$/.test(String(value))) return "";
  const id = Number(value);
  if (!Number.isFinite(id)) return "";
  if (id > 0 && id < 1000) return String(id + 100);
  return String(value);
}

function explicitUrls(club) {
  const values = [];
  const keys = ["logoUrl", "crestUrl", "crestURL", "clubLogoUrl", "badgeUrl", "teamLogoUrl", "imageUrl", "logo", "crestImageUrl"];
  addUnique(values, pick(club?.details, keys));
  addUnique(values, pick(club, keys));
  addUnique(values, walkObject(club, (key, value) => {
    if (!looksLikeCrestKey(key)) return undefined;
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
    return undefined;
  }));
  return values.filter((value) => /^https?:\/\//i.test(value));
}

function crestIdCandidates(club) {
  const ids = [];
  const customKit = club?.details?.customKit || club?.customKit || {};

  const teamValue = pick(club, ["TEAM", "team", "teamId"]) || pick(club?.details, ["TEAM", "team", "teamId"]);
  addUnique(ids, normalizeOfficialTeamCrestId(teamValue));
  addUnique(ids, teamValue);

  const detailsTeamId = pick(club?.details, ["teamId"]);
  addUnique(ids, normalizeOfficialTeamCrestId(detailsTeamId));
  addUnique(ids, detailsTeamId);

  addUnique(ids, pick(customKit, ["crestAssetId", "crestId", "crest", "badgeId", "logoId"]));
  addUnique(ids, pick(club, ["crestAssetId", "crestId", "crestID", "crest", "customCrest", "assetId", "badgeId", "logoId"]));
  addUnique(ids, pick(club?.details, ["crestAssetId", "crestId", "crestID", "crest", "customCrest", "assetId", "badgeId", "logoId"]));
  addUnique(ids, walkObject(club, (key, value) => {
    if (!looksLikeCrestKey(key)) return undefined;
    if (/^\d+$/.test(String(value))) return String(value);
    return undefined;
  }));

  return ids.filter((id) => /^\d+$/.test(String(id)));
}

function crestUrlCandidatesFromClub(club, id) {
  const urls = [];
  if (id && process.env[`EA_LOGO_URL_${id}`]) addUnique(urls, process.env[`EA_LOGO_URL_${id}`]);
  for (const url of explicitUrls(club)) addUnique(urls, url);
  for (const crestId of crestIdCandidates(club)) addUnique(urls, crestUrlForId(crestId));
  return urls;
}

function findCrestId(club) {
  return crestIdCandidates(club)[0] || "";
}

function crestUrlFromClub(club) {
  return crestUrlCandidatesFromClub(club)[0] || "";
}

module.exports = {
  crestUrlCandidatesFromClub,
  crestUrlFromClub,
  findCrestId,
};
