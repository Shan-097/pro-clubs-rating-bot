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

function shortName(name) {
  const value = String(name || "FC").trim();
  return value.length > 25 ? `${value.slice(0, 23)}…` : value;
}

function teamCard(x, team, align = "left") {
  const anchor = align === "right" ? "end" : "start";
  const nameX = align === "right" ? x + 410 : x + 34;
  const scoreX = align === "right" ? x + 58 : x + 388;

  return `<rect x="${x}" y="58" width="465" height="105" rx="22" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.09)"/><text x="${nameX}" y="118" text-anchor="${anchor}" class="team">${esc(shortName(team.name || "Opponent"))}</text><text x="${scoreX}" y="119" text-anchor="middle" class="score">${esc(team.goals ?? 0)}</text>`;
}

function motmCell(r, x, y) {
  if (!r.motm) return `<text x="${x}" y="${y}" text-anchor="middle" class="dim">-</text>`;
  return `<rect x="${x - 36}" y="${y - 22}" width="72" height="30" rx="15" fill="#f0d319"/><text x="${x}" y="${y}" text-anchor="middle" class="motm">YES</text>`;
}

function row(r, i) {
  const y = 342 + i * 47;
  const bg = i % 2 === 0 ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.01)";
  return `<rect x="76" y="${y - 31}" width="1650" height="45" fill="${bg}"/><line x1="76" x2="1726" y1="${y + 18}" y2="${y + 18}" stroke="rgba(255,255,255,.07)"/><text x="105" y="${y}" class="b">${esc(r.player)}</text><text x="365" y="${y}">${esc(r.position)}</text><text x="650" y="${y}" class="b">${esc(rating(r.rating))}</text><text x="760" y="${y}" text-anchor="middle" class="b">${esc(r.goals)}</text><text x="855" y="${y}" text-anchor="middle" class="b">${esc(r.shots)}</text><text x="955" y="${y}" text-anchor="middle" class="b">${esc(r.assists)}</text><text x="1080" y="${y}" class="b">${esc(pair(r.passesMade, r.passesAttempted))}</text><text x="1275" y="${y}" class="b">${esc(pair(r.tacklesMade, r.tacklesAttempted))}</text><text x="1460" y="${y}" text-anchor="middle" class="b">${esc(r.saves)}</text>${motmCell(r, 1605, y)}`;
}

function buildSvg(match) {
  const left = match.leftTeam || {};
  const right = match.rightTeam || {};
  const rows = (match.rows || []).slice(0, 13);
  const sub = [match.competition, dateLabel(match.playedAt), `${match.minutesPlayed || 90} minutes played`]
    .filter(Boolean)
    .join(" • ");
  const headers = [
    [105, "Player"],
    [365, "Position"],
    [650, "MR"],
    [760, "GLS"],
    [855, "SHT"],
    [955, "AST"],
    [1080, "PAS"],
    [1275, "TKL"],
    [1460, "SVS"],
    [1605, "MOTM"],
  ]
    .map(([x, t]) => `<text x="${x}" y="281" ${x >= 760 ? 'text-anchor="middle"' : ""} class="h">${t}</text>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#191919"/><stop offset=".55" stop-color="#080808"/><stop offset="1" stop-color="#000"/></radialGradient><linearGradient id="bar" x1="0" x2="1"><stop offset="0" stop-color="rgba(123,44,255,.25)"/><stop offset=".5" stop-color="rgba(255,255,255,.08)"/><stop offset="1" stop-color="rgba(240,211,25,.20)"/></linearGradient><style>text{font:20px Arial,Helvetica,sans-serif;fill:#fff}.team{font:800 44px Arial}.score{font:900 46px Arial}.versus{font:900 34px Arial;fill:rgba(255,255,255,.9)}.sub{font:700 24px Arial;fill:#f4f4f4}.muted{font:22px Arial;fill:rgba(255,255,255,.72)}.h{font:800 24px Arial;fill:rgba(255,255,255,.92)}.b{font-weight:800}.dim{font:800 18px Arial;fill:rgba(255,255,255,.35)}.motm{font:900 15px Arial;fill:#111}.label{font:800 15px Arial;fill:rgba(255,255,255,.55);letter-spacing:2px}</style></defs><rect width="100%" height="100%" fill="url(#bg)"/><circle cx="910" cy="615" r="270" fill="rgba(255,255,255,.045)"/><circle cx="910" cy="615" r="420" fill="none" stroke="rgba(255,255,255,.025)" stroke-width="80"/><rect x="55" y="35" width="1690" height="915" rx="34" fill="rgba(0,0,0,.20)" stroke="rgba(255,255,255,.07)"/><rect x="76" y="194" width="1650" height="6" rx="3" fill="url(#bar)"/>${teamCard(185, left, "right")}<text x="900" y="116" text-anchor="middle" class="versus">VS</text>${teamCard(1150, right, "left")}<text x="900" y="184" text-anchor="middle" class="sub">${esc(sub)}</text><text x="900" y="217" text-anchor="middle" class="muted">${esc(match.trackedClubName || right.name)} • ${esc(match.trackedPlayers || rows.length)} tracked players</text><rect x="76" y="240" width="1650" height="64" rx="16" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.06)"/><text x="105" y="230" class="label">MATCH STATS</text>${headers}${rows.map(row).join("")}</svg>`;
}

async function renderMatchStatsImage(match) {
  return sharp(Buffer.from(buildSvg(match))).png().toBuffer();
}

module.exports = { renderMatchStatsImage };
