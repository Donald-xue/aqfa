const { computeTable, loadLeague, saveLeague, defaultTeams } = require("../../utils/league");
const { ensureCloudMatchesInitialized, fetchPlayedMatches } = require("../../utils/cloudMatchStore");
const { fetchTeamLogos } = require("../../utils/cloudTeamStore");

Page({
  data: {
    table: [],
    matches: []
  },

  async onShow() {
    await this.refresh();
  },

  async refresh() {
    const { teams } = loadLeague();

    await ensureCloudMatchesInitialized(teams);
    const cloudMatches = await fetchPlayedMatches();
    // 转成 computeTable 需要的结构
    const matches = cloudMatches.map(m => ({
      id: m.id,
      homeId: m.homeId,
      awayId: m.awayId,
      homeGoals: m.homeScore,
      awayGoals: m.awayScore,
      time: `${m.date} ${m.time}` || m.datetime,
      playerEvents: m.playerEvents || []
    }));

    const table = computeTable(teams, matches);

    // 叠加队徽信息
    let teamLogos = {};
    try {
      teamLogos = await fetchTeamLogos();
    } catch (e) {
      console.error("fetchTeamLogos in standings error:", e);
    }
    const tableWithLogo = (table || []).map(row => ({
      ...row,
      logo: teamLogos[row.id] || ""
    }));

    // 为展示方便把球队名写进 match
    const teamMap = new Map(teams.map(t => [t.id, t.name]));
    const matchesView = matches.map(m => ({
      ...m,
      homeName: teamMap.get(m.homeId) || m.homeId,
      awayName: teamMap.get(m.awayId) || m.awayId,
    })).slice().reverse(); // 最新在上

    this.setData({ table: tableWithLogo, matches: matchesView });
  },

  goAddMatch() {
    wx.navigateTo({ url: "/pages/match/match" });
  },

  resetAll() {
    wx.showModal({
      title: "Reset",
      content: "This will clear all matches and reset teams. Continue?",
      success: (res) => {
        if (!res.confirm) return;
        const teams = defaultTeams();
        const matches = [];
        saveLeague({ teams, matches });
        this.refresh();
      }
    });
  },
  deleteMatch(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
  
    wx.showModal({
      title: "Delete Match",
      content: "Are you sure you want to delete this match?",
      success: (res) => {
        if (!res.confirm) return;
  
        const { teams, matches } = loadLeague();
        const newMatches = matches.filter(m => m.id !== id);
  
        saveLeague({ teams, matches: newMatches });
        this.refresh();
  
        wx.showToast({ title: "Deleted", icon: "success" });
      }
    });
  },
  editMatch(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/match/match?mode=edit&id=${id}` });
  },
  goSchedule() {
    wx.navigateTo({ url: "/pages/schedule/schedule" });
  },
  goPlayers() {
    wx.navigateTo({ url: "/pages/players/players" });
  },
  goBoard() {
    wx.navigateTo({ url: "/pages/leaderboard/leaderboard" });
  },
  goCup() {
    // 如果你的杯赛页面路径是 /pages/cup/cup
    wx.navigateTo({ url: "/pages/cup/cup" });
  },
  goFinance() {
    wx.navigateTo({ url: "/pages/finance/finance" });
  }
});
