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
      yellow: 0,
      red: 0,
      apps: 0 // appearance: 只要被选择就算出场（含首发/替补）
    };

    cur.goals += Number(ev.goals) || 0;
    cur.assists += Number(ev.assists) || 0;
    cur.yellow += Number(ev.yellow) || 0;
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
}

Page({
  data: {
    tab: "scorers", // scorers | assisters
    scorers: [],
    assisters: [],
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

      const { scorers, assisters } = computeBoardsFromCloud(matches);

      this.setData({ scorers, assisters, teamNameById });
    } catch (err) {
      console.error("playerBoard onShow error:", err);
      wx.showToast({ title: "Load failed", icon: "none" });
    }
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  }
});
