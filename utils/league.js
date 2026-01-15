// utils/league.js

const { ensureMatchesInitialized, loadMatches } = require("./matchStore");

function defaultTeams() {
  // 你可以改成你的球队
  return [
    { id: "t1", name: "皇家老司机" },
    { id: "t2", name: "学术废物" },
    { id: "t3", name: "香港秦始皇" },
    { id: "t4", name: "西红柿马铃薯" },
    { id: "t5", name: "拜二慕尼黑" },
    { id: "t6", name: "拉斐尔喜悦" },
    { id: "t7", name: "南航小蜘蛛" },
    { id: "t8", name: "恶灵骑士" },
    { id: "t9", name: "我也没意见" },
    { id: "t10", name: "克里文森蓝水泉" },
    { id: "t11", name: "帅气Lee" },
    { id: "t12", name: "医药代表" }
  ];
}

function emptyStats(team) {
  return {
    id: team.id,
    name: team.name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,      // goals for
    ga: 0,      // goals against
    gd: 0,      // goal difference
    points: 0
  };
}

function computeTable(teams, matches) {
  const map = new Map();
  teams.forEach(t => map.set(t.id, emptyStats(t)));

  for (const m of matches) {
    const home = map.get(m.homeId);
    const away = map.get(m.awayId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;

    home.gf += m.homeGoals;
    home.ga += m.awayGoals;

    away.gf += m.awayGoals;
    away.ga += m.homeGoals;

    if (m.homeGoals > m.awayGoals) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (m.homeGoals < m.awayGoals) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const table = Array.from(map.values()).map(r => ({
    ...r,
    gd: r.gf - r.ga
  }));

  // 排序：积分 > 净胜球 > 进球数 > 队名（你也可以加入相互战绩等）
  table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.name.localeCompare(b.name);
  });

  // 加排名
  return table.map((row, idx) => ({ ...row, rank: idx + 1 }));
}
function loadLeague() {
  const teams = wx.getStorageSync("teams") || defaultTeams();

  // ✅ 确保 match_list 已从赛程初始化
  ensureMatchesInitialized(teams);

  // ✅ 从 match_list 取“已录入比分”的比赛用于积分
  const all = loadMatches();
  const matches = all
    .filter(m => m.homeScore !== null && m.awayScore !== null)
    .map(m => ({
      id: m.id,
      homeId: m.homeId,
      awayId: m.awayId,
      homeGoals: m.homeScore,
      awayGoals: m.awayScore,
      time: (m.date && m.time) ? `${m.date} ${m.time}` : (m.datetime || ""),
      playerEvents: m.playerEvents || []
    }));

  return { teams, matches };
}
function saveLeague({ teams }) {
  wx.setStorageSync("teams", teams);
}
/*
function loadLeague() {
  const teams = wx.getStorageSync("teams") || defaultTeams();
  const matches = wx.getStorageSync("matches") || [];
  return { teams, matches };
}

function saveLeague({ teams, matches }) {
  wx.setStorageSync("teams", teams);
  wx.setStorageSync("matches", matches);
}
*/
module.exports = {
  defaultTeams,
  computeTable,
  loadLeague,
  saveLeague
};
