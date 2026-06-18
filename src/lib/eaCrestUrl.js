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

function findCrestId(club) {
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

  return "";
}

function crestUrlFromClub(club) {
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

  const crestId = findCrestId(club);
  if (!crestId) return "";

  const baseUrl = (process.env.EA_CREST_BASE_URL || DEFAULT_CREST_BASE_URL).replace(/\/$/, "");
  return `${baseUrl}/${crestId}.png`;
}

module.exports = {
  crestUrlFromClub,
  findCrestId,
};
