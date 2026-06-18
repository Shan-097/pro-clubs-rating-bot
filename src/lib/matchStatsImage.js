const sharp = require("sharp");
async function renderMatchStatsImage() { return sharp(Buffer.from("<svg></svg>")).png().toBuffer(); }
module.exports = { renderMatchStatsImage };
