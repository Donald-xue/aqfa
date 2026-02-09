// pages/players/players.js (CloudBase version)

const { loadLeague } = require("../../utils/league");

// 本地 players 仅用于“首次迁移”
const { loadPlayers, addPlayer: addPlayerLocal } = require("../../utils/players");

const {
  fetchPlayersByTeam,
  addCloudPlayer,
  deleteCloudPlayer,
  addPlayerLevelDelta,
  addPlayerLevelWithCost,
  transferPlayer,
  updatePlayerAvatar,
  searchPlayersByName
} = require("../../utils/cloudPlayerStore");

const {
  fetchTeamLogos,
  upsertTeamLogo
} = require("../../utils/cloudTeamStore");

Page({
  data: {
    teams: [],
    teamNames: [],
    teamIndex: 0,
    players: [],
    teamLogos: {},
    newName: "",
    newlevel: 0,
    levelDelta: "",
    deltaMap: {},
    starOptions: [1,2,3,4,5],
    starIndex: 4,
    transferFee: "", // 转会费（正数，单位同财务页金币）
    showTransferPicker: false,
    transferCandidates: [],
    transferCandidateIndex: 0,
    transferPlayerId: "",
    transferFromTeamId: "",
    transferFromTeamName: "",
    searchName: "",
    searchResults: [],
    searchSearched: false,
  },

  onStarChange(e) {
    this.setData({ starIndex: Number(e.detail.value) });
  },

  async onShow() {
    const { teams } = loadLeague();
    const baseTeams = teams || [];

    // 追加一个“自由市场”虚拟队伍，仅用于管理未签约球员
    const freeMarketTeam = { id: "free_market", name: "自由市场" };
    const allTeams = [...baseTeams, freeMarketTeam];
    const teamNames = allTeams.map(t => t.name);

    let teamLogos = {};
    try {
      teamLogos = await fetchTeamLogos();
    } catch (e) {
      console.error("fetchTeamLogos error:", e);
    }

    this.setData({ teams: allTeams, teamNames, teamIndex: 0, teamLogos });

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
 //      await addPlayerLevelDelta(team.id, id, delta);
  
      // 清空该行输入
      const deltaMap = { ...(this.data.deltaMap || {}) };
      delete deltaMap[id];
  
      this.setData({ deltaMap });
//      wx.showToast({ title: `+${delta}`, icon: "success" });

      const loginRes = await wx.cloud.callFunction({ name: "login" });
      const openid =
        loginRes?.result?.openid ||
        loginRes?.result?.userInfo?.openId ||
        "";
  
      const r = await addPlayerLevelWithCost(team.id, id, delta, team.name, openid);
      wx.showToast({ title: `+${delta}级 扣费${r.cost}`, icon: "success" });

      await this.refreshPlayers();
    } catch (err) {
      console.error(err);

  if (String(err.message) === "INVALID_DELTA_FOR_STAR4") {
    wx.showToast({ title: "4⭐升级后等级必须是2的倍数，请重输", icon: "none" });
    return;
  }
  if (String(err.message) === "INVALID_DELTA_FOR_STAR3") {
    wx.showToast({ title: "3⭐升级后等级必须是3的倍数，请重输", icon: "none" });
    return;
  }
  if (String(err.message) === "INSUFFICIENT_COINS") {
    wx.showToast({ title: "球队金币不足，升级后会变负数", icon: "none" });
    return;
  }

  wx.showToast({ title: "Save failed", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onTransferFeeInput(e) {
    this.setData({ transferFee: e.detail.value });
  },

  onSearchNameInput(e) {
    this.setData({ searchName: e.detail.value });
  },

  async onSearchPlayer() {
    const name = (this.data.searchName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入球员名", icon: "none" });
      return;
    }

    try {
      wx.showLoading({ title: "搜索中" });
      const list = await searchPlayersByName(name);

      const teams = this.data.teams || [];
      const teamMap = {};
      (teams || []).forEach(t => {
        if (t && t.id) {
          teamMap[String(t.id)] = t.name;
        }
      });

      const results = (list || []).map(p => {
        const teamIdStr = String(p.teamId || "");
        const teamName = teamMap[teamIdStr] || (teamIdStr === "free_market" ? "自由市场" : teamIdStr || "未知队伍");
        return {
          name: p.name,
          teamName
        };
      });

      this.setData({
        searchResults: results,
        searchSearched: true
      });
    } catch (err) {
      console.error("onSearchPlayer error:", err);
      wx.showToast({ title: "搜索失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async onChangeTeamLogo() {
    const teams = this.data.teams || [];
    const team = teams[this.data.teamIndex];
    if (!team || !team.id) return;

    try {
      const chooseRes = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: resolve,
          fail: reject
        });
      });

      const filePath = (chooseRes.tempFilePaths || [])[0];
      if (!filePath) return;

      wx.showLoading({ title: "上传中" });

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `team_logos/${team.id}_${Date.now()}.jpg`,
        filePath
      });

      const fileID = uploadRes.fileID;
      await upsertTeamLogo(team.id, team.name, fileID);

      const teamLogos = { ...(this.data.teamLogos || {}) };
      teamLogos[team.id] = fileID;
      this.setData({ teamLogos });

      wx.showToast({ title: "已更新队徽", icon: "success" });
    } catch (err) {
      console.error("onChangeTeamLogo error:", err);
      wx.showToast({ title: "队徽上传失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  // 打开球员转会弹窗：从当前队伍转到其他队伍或自由市场
  onTransferPlayerTap(e) {
    const id = e.currentTarget.dataset.id;
    const teams = this.data.teams || [];
    const team = teams[this.data.teamIndex];
    if (!team || !id) return;

    // 目的地列表：排除当前队伍，如果当前不是自由市场，则额外提供“自由市场”
    const allCandidates = teams
      .filter(t => t && t.id && t.id !== team.id && t.id !== "free_market")
      .map(t => ({ id: t.id, name: t.name }));

    if (team.id !== "free_market") {
      allCandidates.push({ id: "free_market", name: "自由市场" });
    }

    if (!allCandidates.length) {
      wx.showToast({ title: "暂无可转入的队伍", icon: "none" });
      return;
    }

    this.setData({
      showTransferPicker: true,
      transferCandidates: allCandidates,
      transferCandidateIndex: 0,
      transferPlayerId: id,
      transferFromTeamId: team.id,
      transferFromTeamName: team.name
    });
  },

  onTransferTargetChange(e) {
    this.setData({ transferCandidateIndex: Number(e.detail.value) || 0 });
  },

  onCancelTransfer() {
    this.setData({
      showTransferPicker: false,
      transferCandidates: [],
      transferCandidateIndex: 0,
      transferPlayerId: "",
      transferFromTeamId: "",
      transferFromTeamName: ""
    });
  },

  async onConfirmTransfer() {
    const {
      transferCandidates,
      transferCandidateIndex,
      transferPlayerId,
      transferFromTeamId,
      transferFromTeamName
    } = this.data;

    const target = (transferCandidates || [])[transferCandidateIndex] || transferCandidates[0];
    if (!target || !transferPlayerId || !transferFromTeamId) {
      wx.showToast({ title: "请选择转入队伍", icon: "none" });
      return;
    }

    // 解析本次转会费（可为空或 0）
    const feeRaw = this.data.transferFee;
    const feeNum = Number(feeRaw);
    const fee = Number.isFinite(feeNum) && feeNum >= 0 ? feeNum : 0;

    // 记账人信息复用财务页的显示名
    let displayName = "";
    try {
      displayName = (wx.getStorageSync("finance_display_name") || "").trim();
    } catch (e) {
      displayName = "";
    }

    // 获取 openid 用于 createdBy（可选）
    let openid = "";
    try {
      const loginRes = await wx.cloud.callFunction({ name: "login" });
      openid =
        loginRes?.result?.openid ||
        loginRes?.result?.userInfo?.openId ||
        "";
    } catch (e2) {
      openid = "";
    }

    try {
      wx.showLoading({ title: "转会中" });

      await transferPlayer(
        transferFromTeamId,
        target.id,
        transferPlayerId,
        transferFromTeamName,
        target.name,
        fee,
        openid,
        displayName
      );

      wx.showToast({ title: "已转会", icon: "success" });
      this.setData({ showTransferPicker: false });
      await this.refreshPlayers();
    } catch (err) {
      console.error("transferPlayer error:", err);
      wx.showToast({ title: "转会失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async onChangePlayerAvatar(e) {
    const id = e.currentTarget.dataset.id;
    const teams = this.data.teams || [];
    const team = teams[this.data.teamIndex];
    if (!team || !team.id || !id) return;

    try {
      const chooseRes = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: resolve,
          fail: reject
        });
      });

      const filePath = (chooseRes.tempFilePaths || [])[0];
      if (!filePath) return;

      wx.showLoading({ title: "上传中" });

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `player_avatars/${team.id}_${id}_${Date.now()}.jpg`,
        filePath
      });

      const fileID = uploadRes.fileID;
      await updatePlayerAvatar(team.id, id, fileID);

      const players = (this.data.players || []).map(p => {
        const pid = p.playerId || p.id;
        if (String(pid) !== String(id)) return p;
        return { ...p, avatar: fileID };
      });
      this.setData({ players });

      wx.showToast({ title: "头像已更新", icon: "success" });
    } catch (err) {
      console.error("onChangePlayerAvatar error:", err);
      wx.showToast({ title: "头像上传失败", icon: "none" });
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
