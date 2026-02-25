// pages/schedule/schedule.js (CloudBase integrated)

const { loadLeague } = require("../../utils/league");
const { ensureCloudMatchesInitialized, fetchAllMatches } = require("../../utils/cloudMatchStore");

function groupByRound(list) {
  const roundMap = new Map();   // round -> matches[]
  const noRound = [];           // 没有 round 的比赛

  (list || []).forEach(m => {
    const r = m.round;
    const hasRound = !(r === null || r === undefined || r === "");
    if (!hasRound) {
      noRound.push(m);
      return;
    }

    const key = Number(r);
    if (!roundMap.has(key)) roundMap.set(key, []);
    roundMap.get(key).push(m);
  });

  // 组内排序：按 time；同 time 时用 date 做稳定排序（不改变“按 time”的主规则）
  const sortMatchesByTime = (a, b) => {
    const ta = a.time || "";
    const tb = b.time || "";
    if (ta !== tb) return ta.localeCompare(tb); // "19:30" 这种格式可直接比
    const da = a.date || "";
    const db = b.date || "";
    if (da !== db) return da.localeCompare(db);
    // 再兜底：用 id（如果有）保证稳定
    const ia = a.id || a._id || "";
    const ib = b.id || b._id || "";
    return String(ia).localeCompare(String(ib));
  };

  // 有 round 的组：round 升序
  const rounds = Array.from(roundMap.keys()).sort((a, b) => a - b);

  const groups = rounds.map(r => {
    const matches = roundMap.get(r) || [];
    matches.sort(sortMatchesByTime);
    return {
      round: r,
      title: `第 ${r} 轮`,
      matches
    };
  });

  // 没有 round 的比赛：按 time 排序后，整体放到最后一个组
  if (noRound.length > 0) {
    noRound.sort(sortMatchesByTime);
    groups.push({
      round: "no-round", // WXML 的 wx:key 用这个也行
      title: "未设置轮次",
      matches: noRound
    });
  }

  return groups;
}

function groupByDate(list) {
  const map = new Map();
  (list || []).forEach(m => {
    const k = m.date || "";
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(m);
  });

  const dates = Array.from(map.keys()).sort();
  return dates.map(d => ({ date: d, matches: map.get(d) }));
}

Page({
  data: {
    groups: [],
    teamNames: ["All"],
    teamIndex: 0,

    // 保存云端原始列表，方便筛选
    allMatches: []
  },

  async onShow() {
    try {
      // 1) 本地读取球队（用于把球队名显示在筛选下拉里）
      const { teams } = loadLeague();
      const teamNames = ["All"].concat(teams.map(t => t.name));

      // 2) 确保云端初始化（只会执行一次导入）
      await ensureCloudMatchesInitialized(teams);

      const db = wx.cloud.database();
      const total = await db.collection("matches").where({ leagueId: "aqfa_superleague_2026" }).count();

      // 3) 从云端拉取全部比赛（包含比分/球员）
      const list = await fetchAllMatches();

      // 4) 默认展示 All
      this.setData({
        teamNames,
        teamIndex: 0,
        allMatches: list,
        groups: groupByRound(list)
      });
    } catch (err) {
      console.error("schedule onShow error:", err);
      wx.showToast({ title: "Load failed", icon: "none" });
    }
  },

  // 点击某场 -> 去编辑（云端版 match 页只需要 id）
  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/match/match?id=${id}` });
  },

  // 下拉筛选
  onTeamChange(e) {
    const idx = Number(e.detail.value);
    const team = this.data.teamNames[idx];

    const list = this.data.allMatches || [];
    let filtered = list;

    if (team && team !== "All") {
      filtered = list.filter(m => m.home === team || m.away === team);
    }

    this.setData({
      teamIndex: idx,
      groups: groupByRound(filtered)
    });
  }
});