// utils/cloudPlayerStore.js
// CloudBase players store (single source of truth)

const db = wx.cloud.database();

// ✅ 复用你 matches 的 leagueId（保持一致性）
const { LEAGUE_ID } = require("./cloudMatchStore");

const PLAYERS = db.collection("players");
const COL = "players";
const _ = db.command;

function now() {
  return Date.now();
}

// 分页拉某队球员
async function fetchPlayersByTeam(teamId) {
  const pageSize = 50;
  let all = [];
  let skip = 0;

  while (true) {
    const res = await PLAYERS
      .where({ leagueId: LEAGUE_ID, teamId })
      .orderBy("name", "asc")
      .skip(skip)
      .limit(pageSize)
      .get();

    const batch = res.data || [];
    all = all.concat(batch);

    if (batch.length < pageSize) break;
    skip += pageSize;
  }

  // 统一输出成你页面/逻辑习惯的结构：{id,name}
  return all.map(x => ({ id: x.playerId, name: x.name, level:x.level}));
}

async function addCloudPlayer(teamId, playerId, name, level, star) {
  if (!teamId || !playerId || !name) throw new Error("Missing teamId/playerId/name");

  const st = Number(star);
  const safeStar = Number.isFinite(st) ? Math.min(5, Math.max(1, st)) : 3;

  // 避免重复：同 teamId + playerId 已存在就 update name
  const exist = await PLAYERS.where({ leagueId: LEAGUE_ID, teamId, playerId }).get();
  if (exist.data && exist.data[0]) {
    await PLAYERS.doc(exist.data[0]._id).update({
      data: { name, updatedAt: now(), star: safeStar }
    });
    return;
  }

  await PLAYERS.add({
    data: {
      leagueId: LEAGUE_ID,
      teamId,
      playerId,
      name,
      level,
      star: safeStar,
      createdAt: now(),
      updatedAt: now()
    }
  });
}

async function deleteCloudPlayer(teamId, playerId) {
  if (!teamId || !playerId) return false;
  const res = await PLAYERS.where({ leagueId: LEAGUE_ID, teamId, playerId }).get();
  const doc = res.data && res.data[0];
  if (!doc) return false;
  await PLAYERS.doc(doc._id).remove();
  return true;
}

async function addPlayerLevelDelta(teamId, playerId, delta) {
  const d = Number(delta);
  if (!Number.isFinite(d) || d <= 0) throw new Error("delta must be > 0");

  // 先找到文档 _id
  const res = await db.collection(COL).where({ teamId, playerId }).limit(1).get();
  const doc = (res.data || [])[0];
  if (!doc) throw new Error("Player not found");

  // 原子自增
  return db.collection(COL).doc(doc._id).update({
    data: {
      level: _.inc(d),
      updatedAt: db.serverDate()
    }
  });
}

module.exports = {
  fetchPlayersByTeam,
  addCloudPlayer,
  deleteCloudPlayer,
  addPlayerLevelDelta
};
