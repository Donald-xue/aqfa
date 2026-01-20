const db = wx.cloud.database();

const MATCH_COLLECTION = "matches";
const ADJ_COLLECTION = "finance_adjustments";

// 金币规则
const COIN_WIN = 1000;
const COIN_DRAW = 800;
const COIN_LOSS = 600;

function getHomeTeam(m) { return m.home; }
function getAwayTeam(m) { return m.away; }
function getHomeScore(m) { return (m.homeScore ?? null); }
function getAwayScore(m) { return (m.awayScore ?? null); }

const NAME_KEY = "finance_display_name";
function loadDisplayName() { return wx.getStorageSync(NAME_KEY) || ""; }
function saveDisplayName(name) { wx.setStorageSync(NAME_KEY, name || ""); }

// 分页拉取工具（通用）
async function fetchAll(colQuery, pageSize = 50) {
  let skip = 0;
  let all = [];
  while (true) {
    const res = await colQuery.skip(skip).limit(pageSize).get();
    const batch = res.data || [];
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
}

// 拉云端比赛
async function loadMatchesFromCloud() {
  // 如果你想按赛季/杯赛过滤，这里加 where({ season: '3rd' }) 等即可
  const q = db.collection(MATCH_COLLECTION).orderBy("date", "asc");
  return fetchAll(q, 50);
}

// 拉云端记账记录（按时间倒序）
async function loadAdjustmentsFromCloud() {
  const q = db.collection(ADJ_COLLECTION).orderBy("createdAt", "desc");
  return fetchAll(q, 50);
}

// 从比赛里提取球队（中文名）
function extractTeamsFromMatches(matches) {
  const set = new Set();
  (matches || []).forEach(m => {
    if (m.home) set.add(m.home);
    if (m.away) set.add(m.away);
  });
  return Array.from(set).sort();
}

function computeFinance({ teamOptions, matches, adjustments }) {
  const teamMap = new Map();

  const ensure = (name) => {
    if (!name) return null;
    if (!teamMap.has(name)) {
      teamMap.set(name, {
        key: name,
        name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        coinsFromMatches: 0,
        coinsAdjust: 0,
        coinsTotal: 0,
      });
    }
    return teamMap.get(name);
  };

  // 保证所有球队都显示（即使没比赛）
  (teamOptions || []).forEach(name => ensure(name));

  // 比赛统计
  (matches || []).forEach(m => {
    const home = getHomeTeam(m);
    const away = getAwayTeam(m);
    const hs = getHomeScore(m);
    const as = getAwayScore(m);

    if (!home || !away) return;
    if (hs === null || as === null) return; // 未赛不计金币

    const H = ensure(home);
    const A = ensure(away);
    if (!H || !A) return;

    H.played += 1;
    A.played += 1;

    if (hs > as) {
      H.wins += 1; A.losses += 1;
      H.coinsFromMatches += COIN_WIN;
      A.coinsFromMatches += COIN_LOSS;
    } else if (hs < as) {
      A.wins += 1; H.losses += 1;
      A.coinsFromMatches += COIN_WIN;
      H.coinsFromMatches += COIN_LOSS;
    } else {
      H.draws += 1; A.draws += 1;
      H.coinsFromMatches += COIN_DRAW;
      A.coinsFromMatches += COIN_DRAW;
    }
  });

  // 手动调整
  (adjustments || []).forEach(a => {
    const key = a.teamKey;
    const s = ensure(key);
    if (!s) return;
    s.coinsAdjust += Number(a.amount || 0);
  });

  // 合计 + 排序
  const rows = Array.from(teamMap.values()).map(s => {
    s.coinsTotal = s.coinsFromMatches + s.coinsAdjust;
    return s;
  }).sort((a, b) => {
    if (b.coinsTotal !== a.coinsTotal) return b.coinsTotal - a.coinsTotal;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });

  const summary = {
    win: COIN_WIN,
    draw: COIN_DRAW,
    loss: COIN_LOSS,
    teams: rows.length,
    matchesCounted: (matches || []).filter(m => getHomeScore(m) !== null && getAwayScore(m) !== null).length
  };

  return { rows, summary };
}

Page({
  data: {
    summary: {},
    financeRows: [],
    adjustments: [],
    teamOptions: [],

    showForm: false,
    formTeamKey: "",
    formAmount: "",
    formNote: "",
    displayName: ""
  },

  onShow() {
    this.refresh();
    this.setData({ displayName: loadDisplayName() });
  },

  async refresh() {
    try {
      wx.showLoading({ title: "加载中" });

      const [matches, adjustments] = await Promise.all([
        loadMatchesFromCloud(),
        loadAdjustmentsFromCloud()
      ]);

      const teamOptions = extractTeamsFromMatches(matches);
      const { rows, summary } = computeFinance({ teamOptions, matches, adjustments });

      this.setData({
        summary,
        financeRows: rows,
        adjustments,
        teamOptions
      });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  toggleForm() {
    this.setData({
      showForm: !this.data.showForm,
      formTeamKey: "",
      formAmount: "",
      formNote: ""
    });
  },

  onPickTeam(e) {
    const idx = Number(e.detail.value);
    const name = (this.data.teamOptions || [])[idx] || "";
    this.setData({ formTeamKey: name });
  },

  onNameInput(e){ this.setData({ displayName: e.detail.value }); },
saveName(){
  saveDisplayName(this.data.displayName);
  wx.showToast({ title:"已保存", icon:"success" });
},

  onAmountInput(e) { this.setData({ formAmount: e.detail.value }); },
  onNoteInput(e) { this.setData({ formNote: e.detail.value }); },

  async addAdjustment() {
    const teamKey = (this.data.formTeamKey || "").trim();
    const amount = Number(this.data.formAmount);
    const note = (this.data.formNote || "").trim();

    if (!teamKey) return wx.showToast({ title: "请选择球队", icon: "none" });
    if (!Number.isFinite(amount) || amount === 0) return wx.showToast({ title: "请输入金额(可正可负)", icon: "none" });

    try {
      wx.showLoading({ title: "保存中" });

      // 获取 openid（用于 createdBy）
      const loginRes = await wx.cloud.callFunction({ name: "login" });
      const openid = loginRes?.result?.userInfo?.openId || "";
      const createdName = (this.data.displayName || "").trim() || "匿名";

      await db.collection(ADJ_COLLECTION).add({
        data: {
          teamKey,
          amount,
          note,
          createdAt: db.serverDate(),
          createdBy: openid,
          createdName
        }
      });

      wx.showToast({ title: "已记录", icon: "success" });
      this.setData({ showForm: false, formTeamKey: "", formAmount: "", formNote: "" });
      await this.refresh();
    } catch (e) {
      console.error(e);
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  async removeAdjustment(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    try {
      await db.collection(ADJ_COLLECTION).doc(id).remove();
      wx.showToast({ title: "已删除", icon: "success" });
      await this.refresh();
    } catch (e2) {
      console.error(e2);
      wx.showToast({ title: "删除失败", icon: "none" });
    }
  },

  clearAllAdjustments() {
    wx.showModal({
      title: "确认清空？",
      content: "将删除云端所有记账记录。",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: "清空中" });

          // 分批删除（云端一次 remove 不方便批量，这里用分页读+逐个删）
          const list = await loadAdjustmentsFromCloud();
          await Promise.all(list.map(x => db.collection(ADJ_COLLECTION).doc(x._id).remove()));

          wx.showToast({ title: "已清空", icon: "success" });
          await this.refresh();
        } catch (e) {
          console.error(e);
          wx.showToast({ title: "清空失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      }
    });
  }
});
