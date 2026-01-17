const { ensureScheduleLoaded } = require("../../utils/schedule"); // 你已有
const MATCH_KEY = "match_list";

const { cupGroups, cupGroupMatches } = require("../../data/cupSchedule");

function buildAssistsRankFromCupSchedule(cupGroupMatches, activeCupId, seasonText) {
  const matches = cupGroupMatches.filter(m =>
    m.cupId === activeCupId && m.season === seasonText
  );

  const map = new Map();

  for (const m of matches) {
    const events = Array.isArray(m.playerEvents) ? m.playerEvents : [];
    for (const e of events) {
      const player = e.player || e.playerName;
      if (!player) continue;

      if (!map.has(player)) {
        map.set(player, {
          name: player,
          team: e.team || "",
          goals: 0,
          assists: 0,
        });
      }

      const s = map.get(player);
      if (!s.team && e.team) s.team = e.team;

      if (e.type === "goal") s.goals += 1;
      if (e.type === "assist") s.assists += 1;
    }
  }

  const list = Array.from(map.values());
  list.sort((a, b) => {
    if (b.assists !== a.assists) return b.assists - a.assists;
    if (b.goals !== a.goals) return b.goals - a.goals;
    return a.name.localeCompare(b.name);
  });

  return list.map((x, idx) => ({ rank: idx + 1, ...x }));
}

function buildPlayersRankFromCupSchedule(cupGroupMatches, activeCupId, seasonText) {
  const matches = cupGroupMatches.filter(m =>
    m.cupId === activeCupId && m.season === seasonText
  );

  const map = new Map();

  for (const m of matches) {
    const events = Array.isArray(m.playerEvents) ? m.playerEvents : [];
    for (const e of events) {
      const player = e.player || e.playerName;
      if (!player) continue;

      if (!map.has(player)) {
        map.set(player, {
          name: player,
          team: e.team || "",
          goals: 0,
          assists: 0,
        });
      }

      const s = map.get(player);
      if (!s.team && e.team) s.team = e.team;

      if (e.type === "goal") s.goals += 1;
      if (e.type === "assist") s.assists += 1;
    }
  }

  const list = Array.from(map.values());
  list.sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return a.name.localeCompare(b.name);
  });

  return list.map((x, idx) => ({ rank: idx + 1, ...x }));
}

function buildGroupStandings(allMatches, activeCupId, seasonText) {
  // 只取当前杯赛 + 当前赛季的小组赛
  const groupMatches = allMatches.filter(m =>
    m.cupId === activeCupId &&
    m.season === seasonText &&
    /^Group\s[A-D]$/.test(m.division)
  );

  // 初始化每队统计
  const stats = {};
  cupGroups.forEach(g => {
    g.teams.forEach(t => {
      stats[t] = { name: t, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0, groupId: g.groupId };
    });
  });

  // 累加比赛
  groupMatches.forEach(m => {
    if (m.homeScore === null || m.awayScore === null) return; // 未赛不算
    const home = stats[m.home];
    const away = stats[m.away];
    if (!home || !away) return;

    home.played += 1;
    away.played += 1;

    home.gf += m.homeScore; home.ga += m.awayScore;
    away.gf += m.awayScore; away.ga += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.wins += 1; home.points += 3;
      away.losses += 1;
    } else if (m.homeScore < m.awayScore) {
      away.wins += 1; away.points += 3;
      home.losses += 1;
    } else {
      home.draws += 1; home.points += 1;
      away.draws += 1; away.points += 1;
    }
  });

  Object.values(stats).forEach(s => { s.gd = s.gf - s.ga; });

  // 输出每组 table
  return cupGroups.map(g => {
    const rows = g.teams
      .map(t => stats[t])
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.name.localeCompare(b.name);
      })
      .map((row, idx) => ({ rank: idx + 1, ...row }));

    return { groupId: g.groupId, groupName: g.groupName, rows };
  });
}

function buildKnockoutFromGroups(groupStandings) {
  // 取每组前2：A1/A2/B1/B2/...
  const pick = (groupId, rankIndex, fallback) => {
    const g = groupStandings.find(x => x.groupId === groupId);
    const row = g && Array.isArray(g.rows) ? g.rows[rankIndex] : null;
    return (row && row.name) ? row.name : fallback;
  };

  const A1 = pick("A", 0, "A1");
  const A2 = pick("A", 1, "A2");
  const B1 = pick("B", 0, "B1");
  const B2 = pick("B", 1, "B2");
  const C1 = pick("C", 0, "C1");
  const C2 = pick("C", 1, "C2");
  const D1 = pick("D", 0, "D1");
  const D2 = pick("D", 1, "D2");

  // QF 固定对阵（你要换规则就在这里改）
  const qf = [
    { code: "QF1", id: "QF1", home: A1, away: B2, homeScore: null, awayScore: null },
    { code: "QF2", id: "QF2", home: B1, away: A2, homeScore: null, awayScore: null },
    { code: "QF3", id: "QF3", home: C1, away: D2, homeScore: null, awayScore: null },
    { code: "QF4", id: "QF4", home: D1, away: C2, homeScore: null, awayScore: null },
  ];

  // 如果将来你给 QF 填了比分，这里会自动算胜者；否则显示 W(QF1) 这种占位符
  const winnerOf = (m) => {
    if (m.homeScore === null || m.awayScore === null) return `W(${m.code})`;
    if (m.homeScore > m.awayScore) return m.home;
    if (m.homeScore < m.awayScore) return m.away;
    return `W(${m.code})`; // 平局时先用占位（你也可以改成点球/加赛逻辑）
  };

  const sf = [
    { code: "SF1", id: "SF1", home: winnerOf(qf[0]), away: winnerOf(qf[1]), homeScore: null, awayScore: null },
    { code: "SF2", id: "SF2", home: winnerOf(qf[2]), away: winnerOf(qf[3]), homeScore: null, awayScore: null },
  ];

  const fin = [
    { code: "F", id: "F", home: winnerOf(sf[0]), away: winnerOf(sf[1]), homeScore: null, awayScore: null },
  ];

  return [
    { name: "1/4决赛", matches: qf, showConnectors: true },
    { name: "半决赛", matches: sf, showConnectors: true },
    { name: "决赛", matches: fin, showConnectors: false },
  ];
}

function loadMatches() {
  return wx.getStorageSync(MATCH_KEY) || [];
}
function saveMatches(list) {
  wx.setStorageSync(MATCH_KEY, list || []);
}

// 只初始化一次：用 scheduleData(模板) -> match_list(可编辑)
async function ensureMatchesInitialized() {
  const cached = loadMatches();
  if (Array.isArray(cached) && cached.length > 0) return cached;

  const template = await ensureScheduleLoaded(); // schedule_list
  const list = (Array.isArray(template) ? template : []).map(m => ({
    ...m,
    homeScore: m.homeScore ?? null,
    awayScore: m.awayScore ?? null,
    playerEvents: Array.isArray(m.playerEvents) ? m.playerEvents : []
  }));
  saveMatches(list);
  return list;
}

// 例：把 match_list 切出淘汰赛 rounds（你后面按自己杯赛规则来）
function buildKnockoutRounds(allMatches) {
  // 这里演示：用 division 字段当阶段（你模板里有 division 字段位）:contentReference[oaicite:6]{index=6}
  const byStage = (stage) => allMatches.filter(m => m.division === stage);

  const r16 = byStage("R16");
  const qf  = byStage("QF");
  const sf  = byStage("SF");
  const fin = byStage("F");

  // 没有就给空，页面照样能渲染
  return [
    { name: "1/8决赛", matches: r16, showConnectors: true },
    { name: "1/4决赛", matches: qf,  showConnectors: true },
    { name: "半决赛",  matches: sf,  showConnectors: true },
    { name: "决赛",    matches: fin, showConnectors: false }
  ].filter(x => x.matches.length > 0);
}

Page({
  data: {
    cups: [
      { id: "aqcup", name: "水群杯" },
//      { id: "epl", name: "英超" },
//      { id: "laliga", name: "西甲" },
//      { id: "afcon", name: "非洲杯" }
    ],
    activeCupId: "aqcup",

    seasonOptions: ["1st", "2nd", "3rd"],
    seasonIndex: 2,
    subTab: "standings",

    knockoutRounds: [],
    groupStandings: [], // 你自己算积分榜后塞进来
    knockoutMap: {},
    playersRank: [],
    assistsRank: []
  },

/*  async onShow() {
    const allMatches = await ensureMatchesInitialized();
    // TODO: 这里按 activeCupId + season 过滤（你可以在 match 里加 cupId/season 字段）
    this.setData({
      knockoutRounds: buildKnockoutRounds(allMatches),
      // groupStandings: buildGroupStandings(allMatches, teams)
    });
  }, */
  async onShow() {
    const baseMatches = await ensureMatchesInitialized();
    const allMatches = [...baseMatches, ...cupGroupMatches];
  
    const seasonText = this.data.seasonOptions[this.data.seasonIndex];
  
    const gs = buildGroupStandings(allMatches, this.data.activeCupId, seasonText);
    const playersRank = buildPlayersRankFromCupSchedule(cupGroupMatches, this.data.activeCupId, seasonText);
    const assistsRank = buildAssistsRankFromCupSchedule(
      cupGroupMatches,
      this.data.activeCupId,
      seasonText
    );    
  
    const koRounds = buildKnockoutFromGroups(gs);

    // 展平成 map：{ QF1: {...}, SF1: {...}, F: {...} }
    const knockoutMap = {};
    koRounds.forEach(r => {
      r.matches.forEach(m => {
        if (m.code) knockoutMap[m.code] = m;
      });
    });

    this.setData({
      groupStandings: gs,
      knockoutRounds: koRounds,
      knockoutMap,
      playersRank,
      assistsRank,
    });
  },

  onCupTab(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    this.setData({ activeCupId: id }, () => this.onShow());
  },

  onSeasonChange(e) {
    const idx = Number(e.detail.value);
    this.setData({ seasonIndex: idx }, () => this.onShow());
  },

  onSubTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ subTab: tab });
  },

/*  goKo(e) {
    const code = e.currentTarget.dataset.code; // QF1/SF1/F...
    if (!code) return;
    // 你编辑页如果支持字符串 id 就直接用
    wx.navigateTo({ url: `/pages/match/match?id=${code}` });
  },*/

  goMatch(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    // 进入某场比赛编辑页：编辑比分后写回 match_list
    wx.navigateTo({ url: `/pages/match/match?id=${id}` });
  }
});