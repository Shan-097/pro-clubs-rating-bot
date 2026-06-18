const cache = new Map();

function norm(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function htmlDecode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getAttr(tag, name) {
  const doubleQuoted = tag.match(new RegExp(name + '="([^"]+)"', "i"));
  if (doubleQuoted) return htmlDecode(doubleQuoted[1]);
  const singleQuoted = tag.match(new RegExp(name + "='([^']+)'", "i"));
  return singleQuoted ? htmlDecode(singleQuoted[1]) : "";
}

function logoLookupUrls(team, match) {
  const raw = [process.env.EA_LOGO_LOOKUP_URL, process.env.EA_LOGO_LOOKUP_URLS]
    .filter(Boolean)
    .join("\n");

  return raw
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) =>
      url
        .replaceAll("{clubId}", encodeURIComponent(team.clubId || ""))
        .replaceAll("{teamName}", team.name || "")
        .replaceAll("{teamNameEncoded}", encodeURIComponent(team.name || ""))
        .replaceAll("{matchId}", encodeURIComponent(match?.matchId || ""))
        .replaceAll("{platform}", encodeURIComponent(process.env.EA_PLATFORM || "common-gen5"))
    );
}

function extractLogo(html, teamName) {
  const wanted = norm(teamName);
  const tags = html.match(/<img\s[^>]*>/gi) || [];

  for (const tag of tags) {
    const src = getAttr(tag, "src");
    const alt = getAttr(tag, "alt") || getAttr(tag, "title");
    if (!src.includes("/crests/") || !src.endsWith(".png")) continue;
    const current = norm(alt);
    if (current === wanted || current.includes(wanted) || wanted.includes(current)) return src;
  }

  return "";
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,*/*",
        "User-Agent": "Mozilla/5.0 Dusty-Dynamos-Bot/1.0",
      },
    });
    if (!response.ok) return "";
    return response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveClubWebsiteLogo(team, match) {
  if (!team?.name) return "";

  const key = `${team.clubId || ""}:${team.name}`;
  if (cache.has(key)) return cache.get(key);

  for (const url of logoLookupUrls(team, match || {})) {
    const html = await fetchPage(url);
    if (!html) continue;
    const logo = extractLogo(html, team.name);
    if (logo) {
      cache.set(key, logo);
      return logo;
    }
  }

  cache.set(key, "");
  return "";
}

module.exports = { resolveClubWebsiteLogo };
