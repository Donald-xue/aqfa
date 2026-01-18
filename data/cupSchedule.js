// data/cupSchedule.js
// 4 groups, 3 teams per group, single round robin per group (3 matches each)

const cupGroups = [
  { groupId: "A", groupName: "小组A组", teams: ["香港秦始皇", "我没意见", "西红柿马铃薯"] },
  { groupId: "B", groupName: "小组B组", teams: ["学术废物", "南航小蜘蛛", "拜二慕尼黑"] },
  { groupId: "C", groupName: "小组C组", teams: ["皇家老司机", "医药代表", "恶灵骑士"] },
  { groupId: "D", groupName: "小组D组", teams: ["克里文森蓝水泉", "拉斐尔喜悦", "帅气Lee"] },
];

// 注意：比分 null 表示未赛；你以后填真实比分即可
const cupGroupMatches = [
  // Group A
  { id: 1001, date: "2025-09-01", time: "18:00", home: "香港秦始皇", away: "我没意见", homeScore: 2, awayScore: 1, playerEvents: [
    { type: "goal", player: "lsq", team: "香港秦始皇", minute: 12 },
//    { type: "assist", player: "PlayerB", team: "香港秦始皇", minute: 12 },
    { type: "assist", player: "lsq", team: "香港秦始皇", minute: 12 },
    { type: "goal", player: "PlayerC", team: "我没意见", minute: 55 }
  ], division: "Group A", cupId: "aqcup", season: "3rd" },
  { id: 1002, date: "2025-09-03", time: "18:00", home: "香港秦始皇", away: "西红柿马铃薯", homeScore: null, awayScore: null, playerEvents: [], division: "Group A", cupId: "aqcup", season: "3rd" },
  { id: 1003, date: "2025-09-05", time: "18:00", home: "我没意见", away: "西红柿马铃薯", homeScore: null, awayScore: null, playerEvents: [], division: "Group A", cupId: "aqcup", season: "3rd" },

  // Group B
  { id: 1101, date: "2025-09-01", time: "20:00", home: "学术废物", away: "南航小蜘蛛", homeScore: null, awayScore: null, playerEvents: [], division: "Group B", cupId: "aqcup", season: "3rd" },
  { id: 1102, date: "2025-09-03", time: "20:00", home: "学术废物", away: "拜二慕尼黑", homeScore: null, awayScore: null, playerEvents: [], division: "Group B", cupId: "aqcup", season: "3rd" },
  { id: 1103, date: "2025-09-05", time: "20:00", home: "南航小蜘蛛", away: "拜二慕尼黑", homeScore: null, awayScore: null, playerEvents: [], division: "Group B", cupId: "aqcup", season: "3rd" },

  // Group C
  { id: 1201, date: "2025-09-02", time: "18:00", home: "皇家老司机", away: "医药代表", homeScore: null, awayScore: null, playerEvents: [], division: "Group C", cupId: "aqcup", season: "3rd" },
  { id: 1202, date: "2025-09-04", time: "18:00", home: "皇家老司机", away: "恶灵骑士", homeScore: null, awayScore: null, playerEvents: [], division: "Group C", cupId: "aqcup", season: "3rd" },
  { id: 1203, date: "2025-09-06", time: "18:00", home: "医药代表", away: "恶灵骑士", homeScore: null, awayScore: null, playerEvents: [], division: "Group C", cupId: "aqcup", season: "3rd" },

  // Group D
  { id: 1301, date: "2025-09-02", time: "20:00", home: "克里文森蓝水泉", away: "拉斐尔喜悦", homeScore: null, awayScore: null, playerEvents: [], division: "Group D", cupId: "aqcup", season: "3rd" },
  { id: 1302, date: "2025-09-04", time: "20:00", home: "克里文森蓝水泉", away: "帅气Lee", homeScore: null, awayScore: null, playerEvents: [], division: "Group D", cupId: "aqcup", season: "3rd" },
  { id: 1303, date: "2025-09-06", time: "20:00", home: "拉斐尔喜悦", away: "帅气Lee", homeScore: null, awayScore: null, playerEvents: [], division: "Group D", cupId: "aqcup", season: "3rd" },
];

module.exports = { cupGroups, cupGroupMatches }