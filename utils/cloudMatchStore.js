// utils/cloudMatchStore.js
const db = wx.cloud.database({ env: "cloud1-1gijyc9ne4244500" });
const MATCHES = db.collection("matches");
const LEAGUE_ID = "aqfa_superleague_2026"; // 你可以改成赛季/联赛唯一标识

function now() {
  return db.serverDate();
}

// 只导入一次：如果云端已存在该联赛比赛，就不再重复导入
async function ensureCloudMatchesInitialized(teams) {
  // 看看云端是否已有数据
  const countRes = await MATCHES.where({ leagueId: LEAGUE_ID }).count();
  if (countRes.total > 100) return;

  // 用模板初始化
  const template = require("../data/scheduleData"); // :contentReference[oaicite:1]{index=1}
  const findIdByName = (name) => (teams.find(t => t.name === name) || {}).id || "";

  const docs = (Array.isArray(template) ? template : []).map(x => ({
    leagueId: LEAGUE_ID,
    id: x.id,               // 保留你的赛程 id（用于查找更新）
    date: x.date,
    time: x.time,
    datetime: x.datetime || `${x.date} ${x.time}`,
    ts: x.ts || Date.parse(`${x.date}T${x.time}:00`),

    home: x.home,
    away: x.away,
    homeId: x.homeId || findIdByName(x.home),
    awayId: x.awayId || findIdByName(x.away),

    venue: x.venue || "",
    pitch: x.pitch || "",
    division: x.division || "",

    homeScore: x.homeScore ?? null,
    awayScore: x.awayScore ?? null,
    playerEvents: Array.isArray(x.playerEvents) ? x.playerEvents : [],

    version: 1,             // 乐观锁
    updatedAt: now(),
    updatedBy: ""           // 你也可以写 openid（后面加云函数更稳）
  }));

  // 云数据库一次 add 只支持 1 条，批量要循环（比赛数量不大，OK）
  for (const d of docs) {
    await MATCHES.add({ data: d });
  }
}
async function fetchAllMatches() {
  console.log("[fetchAllMatches] paging version used");
  const pageSize = 10; // 每页取 50（可调，太大可能慢）
  let all = [];
  let skip = 0;

  while (true) {
    const res = await MATCHES
      .where({ leagueId: LEAGUE_ID })
      .orderBy("ts", "asc")
      .skip(skip)
      .limit(pageSize)
      .get();

    const batch = res.data || [];
    all = all.concat(batch);

    if (batch.length < pageSize) break; // 最后一页
    skip += pageSize;
  }

  return all;
}
/*
// 拉取全部比赛（赛程页用）
async function fetchAllMatches() {
  // 注意：云数据库单次 get 有上限，数据多要分页
  const res = await MATCHES
    .where({ leagueId: LEAGUE_ID })
    .orderBy("ts", "asc")
    .get();
  return res.data || [];
}
*/
// 只拉已录入比分的比赛（积分榜用）
async function fetchPlayedMatches() {
  const _ = db.command;
  const res = await MATCHES
    .where({
      leagueId: LEAGUE_ID,
      homeScore: _.neq(null),
      awayScore: _.neq(null)
    })
    .get();
  return res.data || [];
}

// 按 id 找一场（编辑页用）
async function fetchMatchById(id) {
  const res = await MATCHES.where({ leagueId: LEAGUE_ID, id }).get();
  return (res.data && res.data[0]) || null;
}

// 更新某场：带 version 乐观锁，避免并发覆盖
async function updateMatchById(id, patch, expectedVersion) {
  const _ = db.command;
  const whereCond = expectedVersion
    ? { leagueId: LEAGUE_ID, id, version: expectedVersion }
    : { leagueId: LEAGUE_ID, id };

  const res = await MATCHES.where(whereCond).update({
    data: {
      ...patch,
      version: _.inc(1),
      updatedAt: now()
    }
  });

  return res.stats && res.stats.updated === 1; // true=更新成功
}

module.exports = {
  LEAGUE_ID,
  ensureCloudMatchesInitialized,
  fetchAllMatches,
  fetchPlayedMatches,
  fetchMatchById,
  updateMatchById
};
