// data/cupSchedule.js
// 4 groups, 3 teams per group, single round robin per group (3 matches each)

const cupGroups = [
  { groupId: "A", groupName: "小组A组", teams: ["A1", "A2", "A3"] },
  { groupId: "B", groupName: "小组B组", teams: ["B1", "B2", "B3"] },
  { groupId: "C", groupName: "小组C组", teams: ["C1", "C2", "C3"] },
  { groupId: "D", groupName: "小组D组", teams: ["D1", "D2", "D3"] },
];

// 注意：比分 null 表示未赛；你以后填真实比分即可
const cupGroupMatches = [
  // Group A
  { id: 1001, date: "2025-09-01", time: "18:00", home: "A1", away: "A2", homeScore: 2, awayScore: 1, playerEvents: [
    { type: "goal", player: "lsq", team: "A1", minute: 12 },
    { type: "assist", player: "PlayerB", team: "A1", minute: 12 },
    { type: "assist", player: "lsq", team: "A1", minute: 12 },
    { type: "goal", player: "PlayerC", team: "A2", minute: 55 }
  ], division: "Group A", cupId: "aqcup", season: "3rd" },
  { id: 1002, date: "2025-09-03", time: "18:00", home: "A1", away: "A3", homeScore: null, awayScore: null, playerEvents: [], division: "Group A", cupId: "aqcup", season: "3rd" },
  { id: 1003, date: "2025-09-05", time: "18:00", home: "A2", away: "A3", homeScore: null, awayScore: null, playerEvents: [], division: "Group A", cupId: "aqcup", season: "3rd" },

  // Group B
  { id: 1101, date: "2025-09-01", time: "20:00", home: "B1", away: "B2", homeScore: null, awayScore: null, playerEvents: [], division: "Group B", cupId: "aqcup", season: "3rd" },
  { id: 1102, date: "2025-09-03", time: "20:00", home: "B1", away: "B3", homeScore: null, awayScore: null, playerEvents: [], division: "Group B", cupId: "aqcup", season: "3rd" },
  { id: 1103, date: "2025-09-05", time: "20:00", home: "B2", away: "B3", homeScore: null, awayScore: null, playerEvents: [], division: "Group B", cupId: "aqcup", season: "3rd" },

  // Group C
  { id: 1201, date: "2025-09-02", time: "18:00", home: "C1", away: "C2", homeScore: null, awayScore: null, playerEvents: [], division: "Group C", cupId: "aqcup", season: "3rd" },
  { id: 1202, date: "2025-09-04", time: "18:00", home: "C1", away: "C3", homeScore: null, awayScore: null, playerEvents: [], division: "Group C", cupId: "aqcup", season: "3rd" },
  { id: 1203, date: "2025-09-06", time: "18:00", home: "C2", away: "C3", homeScore: null, awayScore: null, playerEvents: [], division: "Group C", cupId: "aqcup", season: "3rd" },

  // Group D
  { id: 1301, date: "2025-09-02", time: "20:00", home: "D1", away: "D2", homeScore: null, awayScore: null, playerEvents: [], division: "Group D", cupId: "aqcup", season: "3rd" },
  { id: 1302, date: "2025-09-04", time: "20:00", home: "D1", away: "D3", homeScore: null, awayScore: null, playerEvents: [], division: "Group D", cupId: "aqcup", season: "3rd" },
  { id: 1303, date: "2025-09-06", time: "20:00", home: "D2", away: "D3", homeScore: null, awayScore: null, playerEvents: [], division: "Group D", cupId: "aqcup", season: "3rd" },
];

module.exports = { cupGroups, cupGroupMatches }