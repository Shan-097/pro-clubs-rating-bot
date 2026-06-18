const sharp = require("sharp");

const W = 1800;
const H = 1000;
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

function row(r, i) {
  const y = 340 + i * 47;
  const player = `${r.player}${r.motm ? " MOTM" : ""}`;
  return `<line x1="85" x2="1685" y1="${y + 20}" y2="${y + 20}" stroke="rgba(255,255,255,.1)"/><text x="110" y="${y}" class="b">${esc(player)}</text><text x="350" y="${y}">${esc(r.position)}</text><text x="675" y="${y}" class="b">${esc(rating(r.rating))}</text><text x="785" y="${y}" class="b">${esc(r.goals)}</text><text x="880" y="${y}" class="b">${esc(r.shots)}</text><text x="980" y="${y}" class="b">${esc(r.assists)}</text><text x="1095" y="${y}" class="b">${esc(pair(r.passesMade, r.passesAttempted))}</text><text x="1290" y="${y}" class="b">${esc(pair(r.tacklesMade, r.tacklesAttempted))}</text><text x="1505" y="${y}" class="b">${esc(r.saves)}</text>`;
}

function buildSvg(match) {
  const left = match.leftTeam || {};
  const right = match.rightTeam || {};
  const rows = (match.rows || []).slice(0, 16);
  const sub = [match.gameNumber || match.competition, dateLabel(match.playedAt), `${match.minutesPlayed || 90} minutes played`].filter(Boolean).join(" • ");
  const heads = [[110,"Player"],[350,"Position"],[675,"MR"],[775,"GLS"],[870,"SHT"],[970,"AST"],[1095,"PAS"],[1290,"TKL"],[1490,"SVS"]].map(([x,t])=>`<text x="${x}" y="285" class="h">${t}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>text{font:19px Arial;fill:white}.title{font:800 47px Arial}.score{font:800 35px Arial}.sub{font:700 24px Arial}.muted{font:22px Arial;fill:rgba(255,255,255,.82)}.h{font:800 25px Arial}.b{font-weight:800}.p{font:31px Arial;fill:rgba(255,255,255,.86)}.ps{font:900 31px Arial;fill:#f0d319}</style><rect width="100%" height="100%" fill="#020202"/><circle cx="900" cy="620" r="260" fill="#151515"/><rect width="100%" height="100%" fill="rgba(0,0,0,.45)"/><text x="650" y="134" text-anchor="end" class="title">${esc(left.name || "Opponent")}</text><text x="785" y="134" class="score">(${esc(left.goals || 0)})</text><text x="910" y="134" text-anchor="middle" class="score">vs</text><text x="1005" y="134" class="score">(${esc(right.goals || 0)})</text><text x="1185" y="134" class="title">${esc(right.name || "Dusty Dynamos")}</text><text x="900" y="176" text-anchor="middle" class="sub">${esc(sub)}</text><text x="900" y="205" text-anchor="middle" class="muted">${esc(match.trackedClubName || right.name)} had ${esc(match.trackedPlayers || rows.length)} tracked players</text><rect x="85" y="245" width="1600" height="64" rx="8" fill="rgba(0,0,0,.56)"/>${heads}${rows.map(row).join("")}<text x="22" y="970" class="p">Powered by</text><text x="200" y="970" class="ps">EA Pro Clubs API</text></svg>`;
}

async function renderMatchStatsImage(match) {
  return sharp(Buffer.from(buildSvg(match))).png().toBuffer();
}

module.exports = { renderMatchStatsImage };
