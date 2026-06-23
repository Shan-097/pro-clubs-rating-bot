const fs = require("fs/promises");
const path = require("path");

const DEFAULT_STORE_PATH = path.resolve(
  process.cwd(),
  "data",
  "postedEaMatches.json"
);

function getStorePath() {
  return process.env.EA_POSTED_MATCHES_FILE || DEFAULT_STORE_PATH;
}

async function ensureStoreFile() {
  const storePath = getStorePath();
  await fs.mkdir(path.dirname(storePath), { recursive: true });

  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, JSON.stringify({ matches: [] }, null, 2));
  }

  return storePath;
}

async function readPostedMatchesStore() {
  const storePath = await ensureStoreFile();
  const raw = await fs.readFile(storePath, "utf8");

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.matches)) {
      return { matches: [] };
    }
    return parsed;
  } catch {
    return { matches: [] };
  }
}

async function writePostedMatchesStore(store) {
  const storePath = await ensureStoreFile();
  const normalized = {
    matches: Array.isArray(store.matches) ? store.matches.slice(-500) : [],
  };

  await fs.writeFile(storePath, JSON.stringify(normalized, null, 2));
}

async function hasPostedMatch(matchId) {
  const store = await readPostedMatchesStore();
  return store.matches.some((match) => String(match.matchId) === String(matchId));
}

async function markMatchPosted(matchRecord) {
  const store = await readPostedMatchesStore();
  const matchId = String(matchRecord.matchId);

  const withoutExisting = store.matches.filter(
    (match) => String(match.matchId) !== matchId
  );

  withoutExisting.push({
    ...matchRecord,
    matchId,
    postedAt: matchRecord.postedAt || new Date().toISOString(),
  });

  await writePostedMatchesStore({ matches: withoutExisting });
}

module.exports = {
  hasPostedMatch,
  markMatchPosted,
  readPostedMatchesStore,
};
