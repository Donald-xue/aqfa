// utils/matchStore.js
const MATCH_KEY = "match_list";

function loadMatches() {
  return wx.getStorageSync(MATCH_KEY) || [];
}
function saveMatches(list) {
  wx.setStorageSync(MATCH_KEY, list || []);
}

// 只在第一次把赛程模板导入为 match_list；如果已有数据就不覆盖
function ensureMatchesInitialized(teams = []) {
  const cached = loadMatches();
  if (Array.isArray(cached) && cached.length > 0) return cached;

  const scheduleTemplate = require("../data/scheduleData"); // :contentReference[oaicite:1]{index=1}
//  const findIdByName = (name) => (teams.find(t => t.name === name) || {}).id || "";
  const findIdByName = (name) =>
    (Array.isArray(teams) ? (teams.find(t => t.name === name) || {}) : {}).id || "";

  const list = (Array.isArray(scheduleTemplate) ? scheduleTemplate : []).map(x => ({
    ...x,
    // 确保这些字段存在（模板里本来就有）
    homeId: x.homeId || findIdByName(x.home),
    awayId: x.awayId || findIdByName(x.away),
    homeScore: x.homeScore ?? null,
    awayScore: x.awayScore ?? null,
    playerEvents: Array.isArray(x.playerEvents) ? x.playerEvents : []
  }));

  saveMatches(list);
  return list;
}

// 更新某一场（按 id）
function updateMatchById(id, patch) {
  const list = loadMatches();
  const idx = list.findIndex(m => m.id === id);
  if (idx < 0) return false;

  const newList = list.slice();
  newList[idx] = { ...newList[idx], ...patch };
  saveMatches(newList);
  return true;
}

module.exports = {
  loadMatches,
  saveMatches,
  ensureMatchesInitialized,
  updateMatchById
};