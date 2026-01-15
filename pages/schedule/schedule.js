// pages/schedule/schedule.js (CloudBase integrated)

const { loadLeague } = require("../../utils/league");
const { ensureCloudMatchesInitialized, fetchAllMatches } = require("../../utils/cloudMatchStore");

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
        groups: groupByDate(list)
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
      groups: groupByDate(filtered)
    });
  }
});