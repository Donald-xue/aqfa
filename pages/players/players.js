// pages/players/players.js (CloudBase version)

const { loadLeague } = require("../../utils/league");

// 本地 players 仅用于“首次迁移”
const { loadPlayers, addPlayer: addPlayerLocal } = require("../../utils/players");

const {
  fetchPlayersByTeam,
  addCloudPlayer,
  deleteCloudPlayer
} = require("../../utils/cloudPlayerStore");

Page({
  data: {
    teams: [],
    teamNames: [],
    teamIndex: 0,
    players: [],
    newName: ""
  },

  async onShow() {
    const { teams } = loadLeague();
    const teamNames = (teams || []).map(t => t.name);

    this.setData({ teams, teamNames, teamIndex: 0 });

    await this.refreshPlayers();
  },

  async onTeamChange(e) {
    this.setData({ teamIndex: Number(e.detail.value) });
    await this.refreshPlayers();
  },

  async refreshPlayers() {
    const team = this.data.teams[this.data.teamIndex];
    if (!team) return;

    try {
      const players = await fetchPlayersByTeam(team.id);
      this.setData({ players });
    } catch (err) {
      console.error("fetchPlayersByTeam error:", err);
      wx.showToast({ title: "Load failed", icon: "none" });
    }
  },

  onNewName(e) {
    this.setData({ newName: e.detail.value });
  },

  async addOne() {
    const name = (this.data.newName || "").trim();
    if (!name) {
      wx.showToast({ title: "Enter player name", icon: "none" });
      return;
    }

    const team = this.data.teams[this.data.teamIndex];
    if (!team) return;

    try {
      // ✅ 继续用你原来的本地生成 playerId 规则（保证风格一致）
      const p = addPlayerLocal(team.id, name); // 返回 {id,name} :contentReference[oaicite:5]{index=5}

      // ✅ 写入云端（云端为权威）
      await addCloudPlayer(team.id, p.id, p.name);

      this.setData({ newName: "" });
      await this.refreshPlayers();
      wx.showToast({ title: "Added", icon: "success" });
    } catch (err) {
      console.error("addOne error:", err);
      wx.showToast({ title: "Add failed", icon: "none" });
    }
  },

  async removeOne(e) {
    const id = e.currentTarget.dataset.id;
    const team = this.data.teams[this.data.teamIndex];
    if (!team || !id) return;

    try {
      await deleteCloudPlayer(team.id, id);
      await this.refreshPlayers();
      wx.showToast({ title: "Deleted", icon: "success" });
    } catch (err) {
      console.error("removeOne error:", err);
      wx.showToast({ title: "Delete failed", icon: "none" });
    }
  }
});
