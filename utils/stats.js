// utils/stats.js
const { loadLeague } = require("./league");

function computePlayerBoard() {
  const { matches } = loadLeague();
  const map = new Map(); // key: playerId

  for (const m of matches) {
    const events = m.playerEvents || [];
    for (const e of events) {
      if (!e || !e.playerId) continue;

      const old = map.get(e.playerId) || {
        playerId: e.playerId,
        playerName: e.playerName || "Unknown",
        teamId: e.teamId,
        goals: 0,
        assists: 0,
        yellow: 0,
        red: 0,
        starter: 0,
        sub: 0,
        appearances: 0
      };

      old.playerName = e.playerName || old.playerName; // 取最新名字
      old.teamId = e.teamId || old.teamId;

      old.goals += Number(e.goals || 0);
      old.assists += Number(e.assists || 0);
      old.yellow += Number(e.yellow || 0);
      old.red += Number(e.red || 0);

      if (e.starter) old.starter += 1;
      if (e.sub) old.sub += 1;
      old.appearances += 1;

      map.set(e.playerId, old);
    }
  }

  // 只保留有进球或助攻的球员
  const all = Array.from(map.values()).filter(p =>
    Number(p.goals) > 0 || Number(p.assists) > 0
  );
//  const all = Array.from(map.values());

  // 射手榜：goals desc, assists desc, name asc
  const scorers = all
    .slice()
    .sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists) || a.playerName.localeCompare(b.playerName));

  // 助攻榜：assists desc, goals desc, name asc
  const assisters = all
    .slice()
    .sort((a, b) => (b.assists - a.assists) || (b.goals - a.goals) || a.playerName.localeCompare(b.playerName));

  return { scorers, assisters };
}

module.exports = { computePlayerBoard };
