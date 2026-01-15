// pages/match/match.js  (CloudBase version + Clear/Delete)

const { loadLeague } = require("../../utils/league");
const {
  ensureCloudMatchesInitialized,
  fetchMatchById,
  updateMatchById,
  // 如果你要物理删除，请在 cloudMatchStore 里实现并取消注释
  // deleteMatchById
} = require("../../utils/cloudMatchStore");
const {
  fetchPlayersByTeam
} = require("../../utils/cloudPlayerStore");

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function initPlayerRows(teamId) {
  const list = await fetchPlayersByTeam(teamId); // ✅ 云端
  return list.map(p => ({
    teamId,
    playerId: p.id,
    playerName: p.name,
    selected: false,
    starter: false,
    sub: false,
    goals: "0",
    assists: "0",
    yellow: "0",
    red: "0"
  }));
}

Page({
  data: {
    teams: [],
    fixtureId: "",

    homeTeamId: "",
    awayTeamId: "",
    homeTeamName: "",
    awayTeamName: "",
    matchDate: "",
    matchTime: "",

    homeGoals: "",
    awayGoals: "",

    homePlayers: [],
    awayPlayers: [],

    version: 0,
    saving: false
  },

  async onLoad(options) {
    const fixtureId = options.id || "";
    if (!fixtureId) {
      wx.showToast({ title: "Missing match id", icon: "none" });
      return;
    }

    const { teams } = loadLeague();
    this.setData({ teams, fixtureId });

    try {
      await ensureCloudMatchesInitialized(teams);
      await this.prefillFromCloud(fixtureId);
    } catch (err) {
      console.error("match onLoad error:", err);
      wx.showToast({ title: "Load failed", icon: "none" });
    }
  },

  async prefillFromCloud(id) {
    const fx = await fetchMatchById(id);
    if (!fx) {
      wx.showToast({ title: "Match not found", icon: "none" });
      return;
    }

    const homeTeamId = fx.homeId || "";
    const awayTeamId = fx.awayId || "";

    const homePlayersBase = homeTeamId ? await initPlayerRows(homeTeamId) : [];
    const awayPlayersBase = awayTeamId ? await initPlayerRows(awayTeamId) : [];

    const events = fx.playerEvents || [];
    const evMap = new Map(events.map(e => [e.playerId, e]));

    const fill = (rows) =>
      rows.map(r => {
        const e = evMap.get(r.playerId);
        if (!e) return r;
        return {
          ...r,
          selected: true,
          starter: !!e.starter,
          sub: !!e.sub,
          goals: String(e.goals ?? 0),
          assists: String(e.assists ?? 0),
          yellow: String(e.yellow ?? 0),
          red: String(e.red ?? 0)
        };
      });

    this.setData({
      version: fx.version || 1,

      homeTeamId,
      awayTeamId,
      homeTeamName: fx.home || "",
      awayTeamName: fx.away || "",
      matchDate: fx.date || "",
      matchTime: fx.time || "",

      homeGoals: fx.homeScore === null || fx.homeScore === undefined ? "" : String(fx.homeScore),
      awayGoals: fx.awayScore === null || fx.awayScore === undefined ? "" : String(fx.awayScore),

      homePlayers: fill(homePlayersBase),
      awayPlayers: fill(awayPlayersBase)
    });

    if (!homeTeamId || !awayTeamId) {
      wx.showToast({ title: "Team mapping failed", icon: "none" });
    }
  },

  onHomeGoals(e) { this.setData({ homeGoals: e.detail.value }); },
  onAwayGoals(e) { this.setData({ awayGoals: e.detail.value }); },

  onDateChange(e) { this.setData({ matchDate: e.detail.value }); },
  onTimeChange(e) { this.setData({ matchTime: e.detail.value }); },

  updatePlayerField(e) {
    const side = e.currentTarget.dataset.side;
    const idx = Number(e.currentTarget.dataset.idx);
    const field = e.currentTarget.dataset.field;

    const key = side === "home" ? "homePlayers" : "awayPlayers";
    const arr = this.data[key].slice();
    const row = { ...arr[idx] };

    let val = e.detail.value;
    if (typeof val === "boolean") {
      // switch
    } else if (Array.isArray(val)) {
      val = val.length > 0;
    }

    row[field] = val;
    arr[idx] = row;
    this.setData({ [key]: arr });
  },

  updatePlayerNumber(e) {
    const side = e.currentTarget.dataset.side;
    const idx = Number(e.currentTarget.dataset.idx);
    const field = e.currentTarget.dataset.field;

    const key = side === "home" ? "homePlayers" : "awayPlayers";
    const arr = this.data[key].slice();
    arr[idx] = { ...arr[idx], [field]: e.detail.value };
    this.setData({ [key]: arr });
  },

  // ✅ 推荐“删除”：清空比赛结果（赛程保留）
  async clearResult() {
    wx.showModal({
      title: "Clear Result",
      content: "This will clear score and player stats for this match. Continue?",
      success: async (res) => {
        if (!res.confirm) return;

        try {
          const ok = await updateMatchById(
            this.data.fixtureId,
            {
              homeScore: null,
              awayScore: null,
              playerEvents: []
            },
            this.data.version
          );

          if (!ok) {
            wx.showModal({
              title: "Conflict",
              content: "This match was updated by someone else. Please reopen and try again.",
              showCancel: false
            });
            return;
          }

          // 清空本页显示（并刷新 version）
          await this.prefillFromCloud(this.data.fixtureId);

          wx.showToast({ title: "Cleared", icon: "success" });
        } catch (err) {
          console.error("clearResult error:", err);
          wx.showToast({ title: "Clear failed", icon: "none" });
        }
      }
    });
  },

  // ⚠️ 不推荐：物理删除云端记录（会破坏赛程完整性）
  // async deleteMatch() {
  //   wx.showModal({
  //     title: "Delete Match",
  //     content: "This will permanently delete this match in cloud. Continue?",
  //     success: async (res) => {
  //       if (!res.confirm) return;
  //
  //       try {
  //         const ok = await deleteMatchById(this.data.fixtureId);
  //         if (!ok) {
  //           wx.showToast({ title: "Delete failed", icon: "none" });
  //           return;
  //         }
  //         wx.showToast({
  //           title: "Deleted",
  //           icon: "success",
  //           duration: 500,
  //           complete: () => wx.navigateBack()
  //         });
  //       } catch (err) {
  //         console.error("deleteMatch error:", err);
  //         wx.showToast({ title: "Delete failed", icon: "none" });
  //       }
  //     }
  //   });
  // },

  async saveMatch() {
    if (this.data.saving) return;
    this.setData({ saving: true });
  
    try {
      const hg = Number(this.data.homeGoals);
      const ag = Number(this.data.awayGoals);
  
      if (!Number.isFinite(hg) || !Number.isFinite(ag) || hg < 0 || ag < 0) {
        wx.showToast({ title: "Invalid score", icon: "none" });
        this.setData({ saving: false });
        return;
      }
  
      const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      };
  
      const pick = (rows) =>
        rows
          .filter(r => r.selected)
          .map(r => ({
            teamId: r.teamId,
            playerId: r.playerId,
            playerName: r.playerName,
            starter: !!r.starter,
            sub: !!r.sub,
            goals: num(r.goals),
            assists: num(r.assists),
            yellow: num(r.yellow),
            red: num(r.red)
          }));
  
      const playerEvents = pick(this.data.homePlayers).concat(pick(this.data.awayPlayers));
  
      const ok = await updateMatchById(this.data.fixtureId, {
        date: this.data.matchDate,
        time: this.data.matchTime,
        homeScore: hg,
        awayScore: ag,
        playerEvents
      });
  
      if (!ok) {
        wx.showToast({ title: "Save failed", icon: "none" });
        this.setData({ saving: false });
        return;
      }
  
      wx.showToast({
        title: "Saved",
        icon: "success",
        duration: 500,
        complete: () => wx.navigateBack()
      });
    } catch (err) {
      console.error("saveMatch error:", err);
      wx.showToast({ title: "Save failed", icon: "none" });
      this.setData({ saving: false });
    }
  }
  
});
