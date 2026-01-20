// pages/players/players.js (CloudBase version)

const { loadLeague } = require("../../utils/league");

// 本地 players 仅用于“首次迁移”
const { loadPlayers, addPlayer: addPlayerLocal } = require("../../utils/players");

const {
  fetchPlayersByTeam,
  addCloudPlayer,
  deleteCloudPlayer,
  addPlayerLevelDelta
} = require("../../utils/cloudPlayerStore");

Page({
  data: {
    teams: [],
    teamNames: [],
    teamIndex: 0,
    players: [],
    newName: "",
    newlevel: 0,
    levelDelta: "",
    deltaMap: {},
    starOptions: [1,2,3,4,5],
    starIndex: 4,
  },

  onStarChange(e) {
    this.setData({ starIndex: Number(e.detail.value) });
  },

  async onShow() {
    const { teams } = loadLeague();
    const teamNames = (teams || []).map(t => t.name);

    this.setData({ teams, teamNames, teamIndex: 0 });

    await this.refreshPlayers();
  },

  onNewLevel(e) {
    // input 方式
    const v = Number(e.detail.value);
    this.setData({ newLevel: Number.isFinite(v) ? v : 1 });
  },

  async addLevelToPlayer(e) {
    const id = e.currentTarget.dataset.id; // playerId
    const team = this.data.teams[this.data.teamIndex];
    if (!team || !id) return;
  
    const delta = Number(e.currentTarget.dataset.delta); // 从行内 input 取
    if (!Number.isFinite(delta) || delta <= 0) {
      wx.showToast({ title: "请输入正整数", icon: "none" });
      return;
    }
  
    try {
      wx.showLoading({ title: "Saving" });
      await addPlayerLevelDelta(team.id, id, delta);
      wx.showToast({ title: `+${delta}`, icon: "success" });
      await this.refreshPlayers();
    } catch (err) {
      console.error("addLevelToPlayer error:", err);
      wx.showToast({ title: "Save failed", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },
  
  onLevelDeltaInput(e) {
    this.setData({ levelDelta: e.detail.value });
  },

  onDeltaInput(e) {
    const id = e.currentTarget.dataset.id;
    const v = e.detail.value;
    const deltaMap = { ...(this.data.deltaMap || {}) };
    deltaMap[id] = v;
    this.setData({ deltaMap });
  },

  async saveDelta(e) {
    const id = e.currentTarget.dataset.id;
    const team = this.data.teams[this.data.teamIndex];
    if (!team || !id) return;
  
    const raw = (this.data.deltaMap || {})[id];
    const delta = Number(raw);
  
    if (!Number.isFinite(delta) || delta <= 0) {
      wx.showToast({ title: "请输入正整数", icon: "none" });
      return;
    }
  
    try {
      wx.showLoading({ title: "Saving" });
      await addPlayerLevelDelta(team.id, id, delta);
  
      // 清空该行输入
      const deltaMap = { ...(this.data.deltaMap || {}) };
      delete deltaMap[id];
  
      this.setData({ deltaMap });
      wx.showToast({ title: `+${delta}`, icon: "success" });
      await this.refreshPlayers();
    } catch (err) {
      console.error("saveDelta error:", err);
      wx.showToast({ title: "Save failed", icon: "none" });
    } finally {
      wx.hideLoading();
    }
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

  onEditLevel(e) {
    const id = e.currentTarget.dataset.id;      // playerId
    const v = Number(e.detail.value);
  
    const players = (this.data.players || []).map(p => {
      const pid = p.playerId || p.id; // 兼容字段名
      if (String(pid) !== String(id)) return p;
      return { ...p, level: Number.isFinite(v) ? v : p.level };
    });
  
    this.setData({ players });
  },
  async saveLevel(e) {
    const id = e.currentTarget.dataset.id; // playerId
    const team = this.data.teams[this.data.teamIndex];
    if (!team || !id) return;
  
    const p = (this.data.players || []).find(x => String((x.playerId || x.id)) === String(id));
    const level = Number(p?.level);
  
    if (!Number.isFinite(level) || level < 1 || level > 150) {
      wx.showToast({ title: "Level 1-150", icon: "none" });
      return;
    }
  
    try {
      wx.showLoading({ title: "Saving" });
      await updateCloudPlayerLevel(team.id, id, level);
      wx.showToast({ title: "Saved", icon: "success" });
      await this.refreshPlayers();
    } catch (err) {
      console.error("saveLevel error:", err);
      wx.showToast({ title: "Save failed", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onNewName(e) {
    this.setData({ newName: e.detail.value });
  },

  async addOne() {
    const name = (this.data.newName || "").trim();
    const level = Number(this.data.newLevel);

    if (!name) {
      wx.showToast({ title: "Enter player name", icon: "none" });
      return;
    }

    const team = this.data.teams[this.data.teamIndex];
    if (!team) return;

    try {
      const normalized = name.toLowerCase();
      const existsLocal = (this.data.players || []).some(p =>
        String(p.name || "").trim().toLowerCase() === normalized
      );
      if (existsLocal) {
        wx.showToast({ title: "Player already exists", icon: "none" });
        return;
      }

      // ✅ 继续用你原来的本地生成 playerId 规则（保证风格一致）
      const p = addPlayerLocal(team.id, name); // 返回 {id,name} :contentReference[oaicite:5]{index=5}

      // ✅ 写入云端（云端为权威）
      const star = this.data.starOptions[this.data.starIndex] || 5;
      await addCloudPlayer(team.id, p.id, p.name, level, star);

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
