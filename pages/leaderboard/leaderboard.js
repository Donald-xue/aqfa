const { loadLeague } = require("../../utils/league");
const { ensureCloudMatchesInitialized, fetchAllMatches } = require("../../utils/cloudMatchStore");

function buildTeamNameById(teams) {
  const map = {};
  (teams || []).forEach(t => (map[t.id] = t.name));
  return map;
}

function isPlayedMatch(m) {
  // 只统计有比分的（你也可以改成只要 playerEvents 有数据就算）
  return m && m.homeScore !== null && m.homeScore !== undefined
    && m.awayScore !== null && m.awayScore !== undefined;
}
/*
function computeBoardsFromCloud(matches) {
  // playerKey: `${teamId}_${playerId}`
  const mp = new Map();

  const add = (ev) => {
    if (!ev || !ev.playerId) return;
    const teamId = ev.teamId || "";
    const playerId = ev.playerId;
    const key = `${teamId}_${playerId}`;

    const cur = mp.get(key) || {
      teamId,
      playerId,
      playerName: ev.playerName || "",
      goals: 0,
      assists: 0,
      MVP: 0,
      red: 0,
      apps: 0 // appearance: 只要被选择就算出场（含首发/替补）
    };

    cur.goals += Number(ev.goals) || 0;
    cur.assists += Number(ev.assists) || 0;
    cur.MVP += Number(ev.MVP) || 0;
    cur.red += Number(ev.red) || 0;
    cur.apps += 1;

    // 如果后来名字更新，以最新为准
    if (ev.playerName) cur.playerName = ev.playerName;

    mp.set(key, cur);
  };

  (matches || []).forEach(m => {
    if (!isPlayedMatch(m)) return;
    const evs = Array.isArray(m.playerEvents) ? m.playerEvents : [];
    evs.forEach(add);
  });

  const list = Array.from(mp.values());

  // 为 0 的不显示：射手榜过滤 goals>0；助攻榜过滤 assists>0
  const scorers = list
    .filter(x => x.goals > 0)
    .sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.apps !== a.apps) return a.apps - b.apps; // 出场少优先（可改）
      return (a.playerName || "").localeCompare(b.playerName || "");
    })
    .map((x, i) => ({ ...x, rank: i + 1 }));

  const assisters = list
    .filter(x => x.assists > 0)
    .sort((a, b) => {
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.apps !== a.apps) return a.apps - b.apps;
      return (a.playerName || "").localeCompare(b.playerName || "");
    })
    .map((x, i) => ({ ...x, rank: i + 1 }));

  return { scorers, assisters };
}*/

function computeBoardsFromCloud(matches) {
  // playerKey: `${teamId}_${playerId}`
  const mp = new Map();

  const ensureRow = (ev) => {
    if (!ev || !ev.playerId) return null;

    const teamId = ev.teamId || "";
    const playerId = ev.playerId;
    const key = `${teamId}_${playerId}`;

    const cur = mp.get(key) || {
      teamId,
      playerId,
      playerName: ev.playerName || "",
      goals: 0,
      assists: 0,
      MVP: 0,
      red: 0,
      apps: 0
    };

    if (ev.playerName) cur.playerName = ev.playerName;
    mp.set(key, cur);
    return cur;
  };

  (matches || []).forEach(m => {
    if (!isPlayedMatch(m)) return;

    const evs = Array.isArray(m.playerEvents) ? m.playerEvents : [];

    // ✅ 同一场比赛：同一球员 apps 只记一次
    const appeared = new Set();

    evs.forEach(ev => {
      const cur = ensureRow(ev);
      if (!cur) return;

      cur.goals += Number(ev.goals) || 0;
      cur.assists += Number(ev.assists) || 0;
      cur.MVP += Number(ev.MVP) || 0;
      cur.red += Number(ev.red) || 0;

      const teamId = ev.teamId || "";
      const playerId = ev.playerId;
      const pKey = `${teamId}_${playerId}`;
      if (!appeared.has(pKey)) {
        cur.apps += 1;
        appeared.add(pKey);
      }
    });
  });

  const list = Array.from(mp.values());

  const scorers = list
    .filter(x => x.goals > 0)
    .sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists; // ✅ 平进球看助攻
      if (b.apps !== a.apps) return a.apps - b.apps;              // 出场少优先
      return (a.playerName || "").localeCompare(b.playerName || "");
    })
    .map((x, i) => ({ ...x, rank: i + 1 }));

  const assisters = list
    .filter(x => x.assists > 0)
    .sort((a, b) => {
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.goals !== a.goals) return b.goals - a.goals;          // ✅ 平助攻看进球
      if (b.apps !== a.apps) return a.apps - b.apps;
      return (a.playerName || "").localeCompare(b.playerName || "");
    })
    .map((x, i) => ({ ...x, rank: i + 1 }));

  const mvpBoard = list
    .filter(x => x.MVP > 0)
    .sort((a, b) => {
      if (b.MVP !== a.MVP) return b.MVP - a.MVP;
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.apps !== a.apps) return a.apps - b.apps;
      return (a.playerName || "").localeCompare(b.playerName || "");
    })
    .map((x, i) => ({ ...x, rank: i + 1 }));

  const redBoard = list
    .filter(x => x.red > 0)
    .sort((a, b) => {
      if (b.red !== a.red) return b.red - a.red;
      if (b.apps !== a.apps) return a.apps - b.apps;              // 同红牌出场少优先（你也可反过来）
      if (b.goals !== a.goals) return b.goals - a.goals;          // 可选：再按进球
      return (a.playerName || "").localeCompare(b.playerName || "");
    })
    .map((x, i) => ({ ...x, rank: i + 1 }));

  return { scorers, assisters, mvpBoard, redBoard };
}

Page({
  data: {
    tab: "scorers", // scorers | assisters
    scorers: [],
    assisters: [],
    mvpBoard: [],
    redBoard: [],
    teamNameById: {}
  },

  async onShow() {
    try {
      const { teams } = loadLeague();
      const teamNameById = buildTeamNameById(teams);

      // 确保云端初始化（只会导入一次）
      await ensureCloudMatchesInitialized(teams);

      // 从云端获取全部比赛
      const matches = await fetchAllMatches();

      const { scorers, assisters, mvpBoard, redBoard } = computeBoardsFromCloud(matches);
      this.setData({ scorers, assisters, mvpBoard, redBoard, teamNameById });
//      const { scorers, assisters } = computeBoardsFromCloud(matches);
//      this.setData({ scorers, assisters, teamNameById });
    } catch (err) {
      console.error("playerBoard onShow error:", err);
      wx.showToast({ title: "Load failed", icon: "none" });
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  }
});
