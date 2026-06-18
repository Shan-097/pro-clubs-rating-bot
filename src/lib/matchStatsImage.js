const sharp = require("sharp");

const W = 1800;
const H = 1000;
const esc = (v) =>
  String(v ?? "").replace(/[&<>'"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[c])
  );
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
  return String(name || "FC")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

async function imageDataUri(url) {
  if (!url || !/^https?:\/\//i.test(url)) return "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 1_500_000) return "";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return "";
  }
}

function logo(x, y, name, dataUri) {
  if (dataUri) {
    return `<circle cx="${x}" cy="${y}" r="38" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.16)"/><image href="${esc(dataUri)}" x="${x - 34}" y="${y - 34}" width="68" height="68" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return `<circle cx="${x}" cy="${y}" r="38" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.16)"/><text x="${x}" y="${y + 9}" text-anchor="middle" class="crest">${esc(initials(name))}</text>`;
}

function star(x, y) {
  return `<text x="${x}" y="${y}" text-anchor="middle" class="star">★</text>`;
}

function row(r, i) {
  const y = 342 + i * 47;
  const bg = i % 2 === 0 ? "rgba(255,255,255,.026)" : "rgba(255,255,255,.012)";
  const motmStar = r.motm ? star(315, y + 2) : "";

  return `<rect x="76" y="${y - 31}" width="1650" height="45" fill="${bg}"/><line x1="76" x2="1726" y1="${y + 18}" y2="${y + 18}" stroke="rgba(255,255,255,.065)"/><text x="105" y="${y}" class="b">${esc(playerName(r.player))}</text>${motmStar}<text x="365" y="${y}">${esc(r.position)}</text><text x="680" y="${y}" class="b">${esc(rating(r.rating))}</text><text x="790" y="${y}" text-anchor="middle" class="b">${esc(r.goals)}</text><text x="890" y="${y}" text-anchor="middle" class="b">${esc(r.shots)}</text><text x="990" y="${y}" text-anchor="middle" class="b">${esc(r.assists)}</text><text x="1130" y="${y}" class="b">${esc(pair(r.passesMade, r.passesAttempted))}</text><text x="1345" y="${y}" class="b">${esc(pair(r.tacklesMade, r.tacklesAttempted))}</text><text x="1585" y="${y}" text-anchor="middle" class="b">${esc(r.saves)}</text>`;
}

function topBar(left, right, leftLogo, rightLogo) {
  const score = `${left.goals ?? 0} - ${right.goals ?? 0}`;
  return `<text x="390" y="114" text-anchor="end" class="team">${esc(shortName(left.name || "Opponent", 22))}</text>${logo(455, 99, left.name, leftLogo)}<text x="900" y="118" text-anchor="middle" class="scoreline">${esc(score)}</text>${logo(1345, 99, right.name, rightLogo)}<text x="1410" y="114" class="team">${esc(shortName(right.name || "Dusty Dynamos", 22))}</text>`;
}

async function buildSvg(match) {
  const left = match.leftTeam || {};
  const right = match.rightTeam || {};
  const rows = (match.rows || []).slice(0, 13);
  const sub = [match.competition, dateLabel(match.playedAt), `${match.minutesPlayed || 90} minutes played`]
    .filter(Boolean)
    .join(" • ");
  const leftLogo = await imageDataUri(left.logoUrl);
  const rightLogo = await imageDataUri(right.logoUrl || process.env.EA_DUSTY_LOGO_URL);
  const headers = [
    [105, "Player"],
    [365, "Position"],
    [680, "MR"],
    [790, "GLS"],
    [890, "SHT"],
    [990, "AST"],
    [1130, "PAS"],
    [1345, "TKL"],
    [1585, "SVS"],
  ]
    .map(([x, t]) => `<text x="${x}" y="281" ${x >= 790 ? 'text-anchor="middle"' : ""} class="h">${t}</text>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#191919"/><stop offset=".55" stop-color="#080808"/><stop offset="1" stop-color="#000"/></radialGradient><linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="rgba(123,44,255,.30)"/><stop offset=".5" stop-color="rgba(255,255,255,.08)"/><stop offset="1" stop-color="rgba(240,211,25,.24)"/></linearGradient><style>text{font:20px Arial,Helvetica,sans-serif;fill:#fff}.team{font:800 42px Arial}.scoreline{font:900 48px Arial;fill:#fff}.sub{font:700 24px Arial;fill:#f4f4f4}.muted{font:22px Arial;fill:rgba(255,255,255,.72)}.h{font:800 24px Arial;fill:rgba(255,255,255,.92)}.b{font-weight:800}.label{font:800 15px Arial;fill:rgba(255,255,255,.55);letter-spacing:2px}.crest{font:900 20px Arial;fill:#fff}.star{font:900 24px Arial;fill:#f0d319}</style></defs><rect width="100%" height="100%" fill="url(#bg)"/><circle cx="910" cy="615" r="270" fill="rgba(255,255,255,.045)"/><circle cx="910" cy="615" r="420" fill="none" stroke="rgba(255,255,255,.025)" stroke-width="80"/><rect x="55" y="35" width="1690" height="915" rx="34" fill="rgba(0,0,0,.20)" stroke="rgba(255,255,255,.07)"/><rect x="76" y="186" width="1650" height="6" rx="3" fill="url(#bar)"/>${topBar(left, right, leftLogo, rightLogo)}<text x="900" y="166" text-anchor="middle" class="sub">${esc(sub)}</text><text x="900" y="217" text-anchor="middle" class="muted">${esc(match.trackedClubName || right.name)} • ${esc(match.trackedPlayers || rows.length)} tracked players</text><rect x="76" y="240" width="1650" height="64" rx="16" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.06)"/><text x="105" y="230" class="label">MATCH STATS</text>${headers}${rows.map(row).join("")}</svg>`;
}

async function renderMatchStatsImage(match) {
  return sharp(Buffer.from(await buildSvg(match))).png().toBuffer();
}

module.exports = { renderMatchStatsImage };