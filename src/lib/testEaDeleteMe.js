const DEFAULT_BASE_URL = `https://${["proclubs", "ea", "com"].join(".")}/api/fc`;
async function x() {
  const url = new URL(`${DEFAULT_BASE_URL}/clubs/matches`);
  const response = await fetch(url);
  return response.text();
}
module.exports = { x };
