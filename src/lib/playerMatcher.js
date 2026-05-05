const players = require("../data/players.json");

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, "")
    .trim();
}

function levenshtein(a, b) {
  const s = normalizeName(a);
  const t = normalizeName(b);

  const dp = Array.from({ length: s.length + 1 }, () =>
    Array(t.length + 1).fill(0)
  );

  for (let i = 0; i <= s.length; i++) dp[i][0] = i;
  for (let j = 0; j <= t.length; j++) dp[0][j] = j;

  for (let i = 1; i <= s.length; i++) {
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[s.length][t.length];
}

function findBestPlayerMatch(inputName) {
  const input = normalizeName(inputName);

  if (!input) {
    return {
      ok: false,
      reason: "empty",
      original: inputName,
    };
  }

  const exact = players.find((player) => normalizeName(player) === input);

  if (exact) {
    return {
      ok: true,
      original: inputName,
      matched: exact,
      confidence: "exact",
    };
  }

  const scored = players
    .map((player) => {
      const normalizedPlayer = normalizeName(player);
      const distance = levenshtein(input, normalizedPlayer);
      const maxLength = Math.max(input.length, normalizedPlayer.length);
      const similarity = 1 - distance / maxLength;

      return {
        player,
        distance,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const best = scored[0];
  const second = scored[1];

  const goodEnough = best.similarity >= 0.72;
  const notTooAmbiguous = !second || best.similarity - second.similarity >= 0.12;

  if (goodEnough && notTooAmbiguous) {
    return {
      ok: true,
      original: inputName,
      matched: best.player,
      confidence: "fuzzy",
      similarity: best.similarity,
    };
  }

  return {
    ok: false,
    reason: "ambiguous",
    original: inputName,
    suggestions: scored.slice(0, 3).map((item) => item.player),
  };
}

module.exports = {
  findBestPlayerMatch,
};