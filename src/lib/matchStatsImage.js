const fs = require("fs/promises");
const sharp = require("sharp");
const { resolveClubWebsiteLogo } = require("./clubWebsiteLogos");

const W = 1800;
const H = 1000;
const TABLE_X = 70;
const TABLE_W = 1660;
const HEADER_Y = 318;
const ROW_START_Y = 405;
const ROW_H = 45;

const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[c]));
const pct = (a, b) => (b ? Math.round((Number(a) / Number(b)) * 100) : 0);
const pair = (a, b) => `${a} / ${b} (${pct(a, b)}%)`;
const rating = (v) => (v === null || v === undefined ? "-" : Number(v).toFixed(2));

function dateLabel(iso) {
  if (!iso) return "Recently";
  const d = new Date(iso);
  const tz = process.env.EA_TIME_ZONE || "Europe/Berlin";
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: tz }).format(d);
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(d);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: tz }).format(d);
  return `${weekday} ${day} ${month}`;
}

function shortName(name, max = 24) {
  const value = String(name || "FC").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function playerName(name) {
  return shortName(name, 22);
}

function initials(name) {
  return String(name || "FC").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function mimeFromPath(filePath) {
  const lower = String(filePath).toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

async function imageDataUri(source) {
  if (!source) return "";
  const value = String(source).trim();
  if (value.startsWith("data:image/")) return value;
  if (/^https?:\/\//i.test(value)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(value, {
        signal: controller.signal,
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 Dusty-Dynamos-Bot/1.0",
          Referer: "https://www.ea.com/",
        },
      });
      clearTimeout(timeout);
      if (!response.ok) {
        if (process.env.EA_LOGO_DEBUG === "true") console.warn(`Logo fetch failed ${response.status}: ${value}`);
        return "";
      }
      const contentType = response.headers.get("content-type") || "image/png";
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 1_500_000) {
        if (process.env.EA_LOGO_DEBUG === "true") console.warn(`Logo too large ${buffer.length}: ${value}`);
        return "";
      }
      if (process.env.EA_LOGO_DEBUG === "true") console.log(`Logo loaded: ${value}`);
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    } catch (error) {
      if (process.env.EA_LOGO_DEBUG === "true") console.warn(`Logo fetch exception: ${value} ${error.message}`);
      return "";
    }
  }
  try {
    const buffer = await fs.readFile(value);
    if (buffer.length > 1_500_000) return "";
    if (process.env.EA_LOGO_DEBUG === "true") console.log(`Logo file loaded: ${value}`);
    return `data:${mimeFromPath(value)};base64,${buffer.toString("base64")}`;
  } catch (error) {
    if (process.env.EA_LOGO_DEBUG === "true") console.warn(`Logo file failed: ${value} ${error.message}`);
    return "";
  }
}

async function logoData(team, match, fallbackSources = []) {
  const sources = [team.logoUrl, ...(team.logoUrls || []), ...fallbackSources].filter(Boolean);
  const uniqueSources = [...new Set(sources)];
  if (process.env.EA_LOGO_DEBUG === "true") console.log(`Logo candidates for ${team.name}:`, uniqueSources);
  for (const source of uniqueSources) {
    const data = await imageDataUri(source);
    if (data) return data;
  }
  const fromPage = await resolveClubWebsiteLogo(team, match);
  if (process.env.EA_LOGO_DEBUG === "true" && fromPage) console.log(`Logo from lookup page for ${team.name}: ${fromPage}`);
  return imageDataUri(fromPage);
}

function logo(x, y, name, dataUri) {
  if (dataUri) {
    return `<circle cx="${x}" cy="${y}" r="62" fill="rgba(255,255,255,.075)" stroke="rgba(255,255,255,.18)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="53" fill="rgba(0,0,0,.28)"/><image href="${esc(dataUri)}" x="${x - 49}" y="${y - 49}" width="98" height="98" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<circle cx="${x}" cy="${y}" r="62" fill="rgba(255,255,255,.075)" stroke="rgba(255,255,255,.18)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="42" fill="rgba(0,0,0,.35)"/><text x="${x}" y="${y + 11}" text-anchor="middle" class="crest">${esc(initials(name))}</text>`;
}

function star(x, y) {
  return `<text x="${x}" y="${y}" text-anchor="middle" class="star">★</text>`;
}

function row(r, i) {
  const y = ROW_START_Y + i * ROW_H;
  const bg = i % 2 === 0 ? "rgba(255,255,255,.038)" : "rgba(255,255,255,.018)";
  const motmStar = r.motm ? star(315, y + 2) : "";
  return `<rect x="${TABLE_X}" y="${y - 30}" width="${TABLE_W}" height="43" fill="${bg}"/><line x1="${TABLE_X}" x2="${TABLE_X + TABLE_W}" y1="${y + 17}" y2="${y + 17}" stroke="rgba(255,255,255,.07)"/><text x="105" y="${y}" class="b">${esc(playerName(r.player))}</text>${motmStar}<text x="365" y="${y}">${esc(r.position)}</text><text x="680" y="${y}" text-anchor="middle" class="b">${esc(rating(r.rating))}</text><text x="790" y="${y}" text-anchor="middle" class="b">${esc(r.goals)}</text><text x="890" y="${y}" text-anchor="middle" class="b">${esc(r.shots)}</text><text x="990" y="${y}" text-anchor="middle" class="b">${esc(r.assists)}</text><text x="1130" y="${y}" class="b">${esc(pair(r.passesMade, r.passesAttempted))}</text><text x="1345" y="${y}" class="b">${esc(pair(r.tacklesMade, r.tacklesAttempted))}</text><text x="1585" y="${y}" text-anchor="middle" class="b">${esc(r.saves)}</text>`;
}

function topBar(left, right, leftLogo, rightLogo) {
  const score = `${left.goals ?? 0} - ${right.goals ?? 0}`;
  return `<g filter="url(#softShadow)">
    <text x="405" y="135" text-anchor="end" class="team">${esc(shortName(left.name || "Opponent", 21))}</text>
    ${logo(500, 112, left.name, leftLogo)}
    <rect x="715" y="55" width="370" height="116" rx="34" fill="rgba(0,0,0,.42)" stroke="rgba(255,255,255,.10)"/>
    <text x="900" y="139" text-anchor="middle" class="scoreline">${esc(score)}</text>
    ${logo(1300, 112, right.name, rightLogo)}
    <text x="1395" y="135" class="team">${esc(shortName(right.name || "Dusty Dynamos", 21))}</text>
  </g>`;
}

function backgroundSvg() {
  return `<defs>
    <radialGradient id="bg" cx="50%" cy="33%" r="82%">
      <stop offset="0" stop-color="#242424"/>
      <stop offset=".38" stop-color="#0b0d10"/>
      <stop offset="1" stop-color="#000"/>
    </radialGradient>
    <radialGradient id="leftGlow" cx="23%" cy="16%" r="42%">
      <stop offset="0" stop-color="rgba(123,44,255,.38)"/>
      <stop offset=".55" stop-color="rgba(123,44,255,.06)"/>
      <stop offset="1" stop-color="rgba(123,44,255,0)"/>
    </radialGradient>
    <radialGradient id="rightGlow" cx="77%" cy="16%" r="42%">
      <stop offset="0" stop-color="rgba(240,211,25,.30)"/>
      <stop offset=".58" stop-color="rgba(240,211,25,.05)"/>
      <stop offset="1" stop-color="rgba(240,211,25,0)"/>
    </radialGradient>
    <linearGradient id="bar" x1="0" x2="1">
      <stop offset="0" stop-color="#6a2cff"/>
      <stop offset=".48" stop-color="rgba(255,255,255,.22)"/>
      <stop offset="1" stop-color="#f0d319"/>
    </linearGradient>
    <linearGradient id="tableHeader" x1="0" x2="1">
      <stop offset="0" stop-color="rgba(255,255,255,.10)"/>
      <stop offset=".5" stop-color="rgba(255,255,255,.065)"/>
      <stop offset="1" stop-color="rgba(255,255,255,.10)"/>
    </linearGradient>
    <pattern id="diag" width="38" height="38" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
      <rect width="38" height="38" fill="rgba(255,255,255,0)"/>
      <rect width="2" height="38" fill="rgba(255,255,255,.018)"/>
    </pattern>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity=".55"/>
    </filter>
    <style>text{font:21px Arial,Helvetica,sans-serif;fill:#fff}.team{font:900 56px Arial,Helvetica,sans-serif;letter-spacing:-1px}.scoreline{font:900 86px Arial,Helvetica,sans-serif;fill:#fff}.sub{font:800 30px Arial,Helvetica,sans-serif;fill:#f4f4f4}.h{font:900 25px Arial,Helvetica,sans-serif;fill:rgba(255,255,255,.94)}.b{font-weight:850}.label{font:900 15px Arial,Helvetica,sans-serif;fill:rgba(255,255,255,.58);letter-spacing:2.7px}.crest{font:900 24px Arial,Helvetica,sans-serif;fill:#fff}.star{font:900 24px Arial,Helvetica,sans-serif;fill:#f0d319}</style>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#leftGlow)"/>
  <rect width="100%" height="100%" fill="url(#rightGlow)"/>
  <rect width="100%" height="100%" fill="url(#diag)" opacity=".55"/>
  <ellipse cx="900" cy="690" rx="525" ry="360" fill="rgba(255,255,255,.045)"/>
  <ellipse cx="900" cy="690" rx="405" ry="275" fill="rgba(0,0,0,.12)"/>
  <circle cx="900" cy="690" r="250" fill="none" stroke="rgba(255,255,255,.04)" stroke-width="76"/>
  <path d="M70 882 C410 790 615 790 900 882 C1185 974 1390 974 1730 882" fill="none" stroke="rgba(68,130,46,.14)" stroke-width="120"/>
  <rect x="45" y="32" width="1710" height="920" rx="38" fill="rgba(0,0,0,.24)" stroke="rgba(255,255,255,.085)"/>
  <rect x="45" y="32" width="1710" height="208" rx="38" fill="rgba(255,255,255,.025)"/>
  <rect x="70" y="260" width="1660" height="640" rx="24" fill="rgba(0,0,0,.18)" stroke="rgba(255,255,255,.05)"/>`;
}

async function buildSvg(match) {
  const left = match.leftTeam || {};
  const right = match.rightTeam || {};
  const rows = (match.rows || []).slice(0, 12);
  const sub = [match.competition, dateLabel(match.playedAt), `${match.minutesPlayed || 90} minutes played`].filter(Boolean).join(" • ");
  const leftLogo = await logoData(left, match, [process.env.EA_HOME_LOGO_URL, process.env.EA_LEFT_LOGO_URL]);
  const rightLogo = await logoData(right, match, [process.env.EA_DUSTY_LOGO_URL, process.env.EA_AWAY_LOGO_URL, process.env.EA_RIGHT_LOGO_URL]);
  const headers = [[105, "Player"], [365, "Position"], [680, "MR"], [790, "GLS"], [890, "SHT"], [990, "AST"], [1130, "PAS"], [1345, "TKL"], [1585, "SVS"]].map(([x, t]) => `<text x="${x}" y="${HEADER_Y}" ${x >= 680 ? 'text-anchor="middle"' : ""} class="h">${t}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${backgroundSvg()}${topBar(left, right, leftLogo, rightLogo)}<text x="900" y="213" text-anchor="middle" class="sub">${esc(sub)}</text><rect x="70" y="248" width="1660" height="7" rx="4" fill="url(#bar)"/><text x="100" y="290" class="label">MATCH STATS</text><rect x="70" y="294" width="1660" height="68" rx="18" fill="url(#tableHeader)" stroke="rgba(255,255,255,.08)"/>${headers}${rows.map(row).join("")}</svg>`;
}

async function renderMatchStatsImage(match) {
  return sharp(Buffer.from(await buildSvg(match))).png().toBuffer();
}

module.exports = { renderMatchStatsImage };
