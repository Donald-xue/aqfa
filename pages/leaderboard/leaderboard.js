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
      if (b.apps !== a.apps) return a.apps - b.apps;
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
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
    tab: "scorers", // scorers | assisters | mvp | red

    // ✅ 队伍筛选
    teams: [],
    teamNames: ["All Teams"],
    teamIndex: 0,          // picker 选中 index
    teamFilterId: "",      // "" 表示 All

    // ✅ 展示用（已过滤）
    scorers: [],
    assisters: [],
    mvpBoard: [],
    redBoard: [],

    // ✅ 原始全量（未过滤）
    rawScorers: [],
    rawAssisters: [],
    rawMvpBoard: [],
    rawRedBoard: [],

    teamNameById: {}
  },

  async onShow() {
    try {
      const { teams } = loadLeague();
      const teamNameById = buildTeamNameById(teams);

      // picker：All + 各队
      const teamNames = ["All Teams"].concat((teams || []).map(t => t.name));

      await ensureCloudMatchesInitialized(teams);
      const matches = await fetchAllMatches();

      const { scorers, assisters, mvpBoard, redBoard } = computeBoardsFromCloud(matches);

      // ✅ 保存全量 + 默认应用筛选（All）
      this.setData({
        teams,
        teamNames,
        teamNameById,
        rawScorers: scorers,
        rawAssisters: assisters,
        rawMvpBoard: mvpBoard,
        rawRedBoard: redBoard
      });

      this.applyTeamFilter(); // 用当前 teamFilterId 过滤一次
    } catch (err) {
      console.error("leaderboard onShow error:", err);
      wx.showToast({ title: "Load failed", icon: "none" });
    }
  },

  // ✅ 根据 teamFilterId 过滤四个榜单
  applyTeamFilter() {
    const teamId = this.data.teamFilterId; // "" = All

    const filterFn = (arr) => {
      if (!teamId) return arr || [];
      return (arr || []).filter(x => x.teamId === teamId);
    };

    this.setData({
      scorers: filterFn(this.data.rawScorers),
      assisters: filterFn(this.data.rawAssisters),
      mvpBoard: filterFn(this.data.rawMvpBoard),
      redBoard: filterFn(this.data.rawRedBoard)
    });
  },

  // ✅ picker 切换队伍
  onTeamFilterChange(e) {
    const idx = Number(e.detail.value);
    const teams = this.data.teams || [];
    const teamFilterId = idx === 0 ? "" : (teams[idx - 1] ? teams[idx - 1].id : "");
    this.setData({ teamIndex: idx, teamFilterId });
    this.applyTeamFilter();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  }
});
