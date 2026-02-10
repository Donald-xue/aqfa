// utils/cloudTeamStore.js
// 云端存储球队队徽等信息

const db = wx.cloud.database();
const { LEAGUE_ID } = require("./cloudMatchStore");

const TEAMS_COL = db.collection("teams");

function now() {
  return db.serverDate();
}

// 读取当前联赛下所有球队的队徽，返回 map: { [teamId]: logoFileId }
async function fetchTeamLogos() {
  const res = await TEAMS_COL.where({ leagueId: LEAGUE_ID }).get();
  const list = res.data || [];
  const map = {};
  list.forEach(item => {
    if (item.teamId && item.logo) {
      map[item.teamId] = item.logo;
    }
  });
  return map;
}

// 写入或更新某支球队的队徽
async function upsertTeamLogo(teamId, teamName, logoFileId) {
  if (!teamId || !logoFileId) {
    throw new Error("Missing teamId/logoFileId");
  }

  const res = await TEAMS_COL.where({ leagueId: LEAGUE_ID, teamId }).limit(1).get();
  const doc = (res.data || [])[0];

  if (doc && doc._id) {
    await TEAMS_COL.doc(doc._id).update({
      data: {
        teamName: teamName || doc.teamName || "",
        logo: logoFileId,
        updatedAt: now()
      }
    });
  } else {
    await TEAMS_COL.add({
      data: {
        leagueId: LEAGUE_ID,
        teamId,
        teamName: teamName || "",
        logo: logoFileId,
        createdAt: now(),
        updatedAt: now()
      }
    });
  }

  return { teamId, logo: logoFileId };
}

module.exports = {
  fetchTeamLogos,
  upsertTeamLogo
};

