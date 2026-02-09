// utils/cloudPlayerStore.js
// CloudBase players store (single source of truth)

const db = wx.cloud.database();

// ✅ 复用你 matches 的 leagueId（保持一致性）
const { LEAGUE_ID } = require("./cloudMatchStore");

const PLAYERS = db.collection("players");
const COL = "players";
const _ = db.command;
const MATCHES = db.collection("matches");
const COIN_DRAW = 800;

const PLAYERS_COL = db.collection("players");
const FIN_ADJ_COL = db.collection("finance_adjustments");

function stepByStar(star) {
  if (star >= 5) return 1;
  if (star === 4) return 2;
  if (star === 3) return 3;
  return Infinity;
}

function calcUpgradeCost(oldLevel, delta, star) {
  const step = stepByStar(Number(star));
  if (!Number.isFinite(step) || step === Infinity) return 0;

  const o = Number(oldLevel) || 0;
  const d = Number(delta) || 0;
  const n = o + d;

  const charges = Math.floor(n / step) - Math.floor(o / step);
  return Math.max(0, charges) * 100;
}

async function addPlayerLevelWithCost(teamId, playerId, delta, teamName, createdBy = "") {
  const d = Number(delta);
  if (!teamId || !playerId) throw new Error("Missing teamId/playerId");
  if (!Number.isFinite(d) || d <= 0) throw new Error("delta must be > 0");
  if (!teamName) throw new Error("Missing teamName");

  // 1) 先读球员（拿到 star / level / docId）
  const exist = await PLAYERS_COL
    .where({ leagueId: LEAGUE_ID, teamId, playerId })
    .limit(1)
    .get();

  const doc = exist.data && exist.data[0];
  if (!doc) throw new Error("Player not found");

  const oldLevel = Number(doc.level) || 0;
  const star = Number(doc.star) || 5;
  const newLevel = oldLevel + d;

  // ✅ 升级合法性校验（按星级限制 newLevel 必须是倍数）
  if (star === 4 && (newLevel % 2 !== 0)) {
    const err = new Error("INVALID_DELTA_FOR_STAR4");
    err.detail = { star, oldLevel, delta: d, newLevel };
    throw err;
  }
  if (star === 3 && (newLevel % 3 !== 0)) {
    const err = new Error("INVALID_DELTA_FOR_STAR3");
    err.detail = { star, oldLevel, delta: d, newLevel };
    throw err;
  }

  const cost = calcUpgradeCost(oldLevel, d, star);

  // ✅ 余额不能为负：升级前先算当前球队余额
  if (cost > 0) {
    const balance = await getTeamCoins(teamName);
    if (balance - cost < 0) {
      const err = new Error("INSUFFICIENT_COINS");
      err.detail = { balance, cost };
      throw err;
    }
  }

  // 2) 更新 level（原子自增）
  await PLAYERS_COL.doc(doc._id).update({
    data: { level: _.inc(d), updatedAt: now() }
  });

  // 3) 写扣费记账（负数）
  if (cost > 0) {
    await FIN_ADJ_COL.add({
      data: {
        leagueId: LEAGUE_ID,
        teamKey: teamName, // 中文队名
        amount: -cost,
        note: `升级扣费：${doc.name} +${d}级（${star}⭐）`,
        createdAt: now(),
        createdBy: createdBy || ""
      }
    });
  }

  return { oldLevel, newLevel, star, cost };
}

async function fetchAll(query, pageSize = 50) {
  let skip = 0;
  let all = [];
  while (true) {
    const res = await query.skip(skip).limit(pageSize).get();
    const batch = res.data || [];
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
}

// 计算某支球队当前总金币（match + finance_adjustments）
async function getTeamCoins(teamName) {
  if (!teamName) return 0;

  // 1) 比赛金币：取所有含该队的比赛（home/away），只算已完赛
  const matches = await fetchAll(
    MATCHES.where(_.or([{ home: teamName }, { away: teamName }])),
    50
  );

  let coinsFromMatches = 0;
  for (const m of matches) {
    const hs = m.homeScore ?? null;
    const as = m.awayScore ?? null;
    if (hs === null || as === null) continue;

    const isHome = m.home === teamName;
    const my = isHome ? hs : as;
    const opp = isHome ? as : hs;

    if (my > opp) coinsFromMatches += COIN_WIN;
    else if (my < opp) coinsFromMatches += COIN_LOSS;
    else coinsFromMatches += COIN_DRAW;
  }

  // 2) 手动记账：sum(amount)
  const adjs = await fetchAll(
//    FIN_ADJ_COL.where({ leagueId: LEAGUE_ID, teamKey: teamName }),
    FIN_ADJ_COL.where({ teamKey: teamName }),
    50
  );

  let coinsAdjust = 0;
  for (const a of adjs) coinsAdjust += Number(a.amount || 0);

  return coinsFromMatches + coinsAdjust;
}

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
  return all.map(x => ({ id: x.playerId, name: x.name, level:x.level, star:x.star}));
}

// 球员转会：在同一联赛内从一支队伍转到另一支队伍（或自由市场），可选附带转会费记账
// fee >= 0 且双方都是真实球队时：fromTeam +fee，toTeam -fee（fee=0 时也会写 0 元记录）
async function transferPlayer(
  fromTeamId,
  toTeamId,
  playerId,
  fromTeamName = "",
  toTeamName = "",
  fee = 0,
  createdBy = "",
  createdName = ""
) {
  if (!fromTeamId || !toTeamId || !playerId) {
    throw new Error("Missing fromTeamId/toTeamId/playerId");
  }

  // 找到当前所在队伍下的该球员
  const res = await PLAYERS_COL
    .where({ leagueId: LEAGUE_ID, teamId: fromTeamId, playerId })
    .limit(1)
    .get();

  const doc = (res.data || [])[0];
  if (!doc) {
    throw new Error("Player not found");
  }

  // 直接更新 teamId 即可（不改 playerId / 其他信息）
  await PLAYERS_COL.doc(doc._id).update({
    data: {
      teamId: toTeamId,
      updatedAt: now()
    }
  });

  const isRealTeam = (tid) => tid && tid !== "free_market";
  const rawAmount = Number(fee);
  const amount = Number.isFinite(rawAmount) && rawAmount >= 0 ? rawAmount : 0;

  // 双方都是真实球队时，写转会费记账（包括 0 元转会）
  if (isRealTeam(fromTeamId) && isRealTeam(toTeamId) && amount >= 0 && fromTeamName && toTeamName) {
    const noteBase = `转会费：${doc.name} (${fromTeamName} -> ${toTeamName})`;

    await Promise.all([
      // 出队一方：收入
      FIN_ADJ_COL.add({
        data: {
          leagueId: LEAGUE_ID,
          teamKey: fromTeamName,
          amount: amount,
          note: `${noteBase} 收入`,
          createdAt: now(),
          createdBy: createdBy || "",
          createdName: createdName || ""
        }
      }),
      // 加盟一方：支出
      FIN_ADJ_COL.add({
        data: {
          leagueId: LEAGUE_ID,
          teamKey: toTeamName,
          amount: -amount,
          note: `${noteBase} 支出`,
          createdAt: now(),
          createdBy: createdBy || "",
          createdName: createdName || ""
        }
      })
    ]);
  }

  return { playerId, fromTeamId, toTeamId, name: doc.name };
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
  addPlayerLevelDelta,
  addPlayerLevelWithCost,
  transferPlayer
};
