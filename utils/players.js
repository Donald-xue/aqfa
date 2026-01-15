// utils/players.js

function key(teamId) {
  return `players_${teamId}`;
}

function loadPlayers(teamId) {
  return wx.getStorageSync(key(teamId)) || [];
}

function savePlayers(teamId, players) {
  wx.setStorageSync(key(teamId), players);
}

function addPlayer(teamId, name) {
  const players = loadPlayers(teamId);
  const p = { id: "p_" + Date.now() + "_" + Math.random().toString(16).slice(2), name: name.trim() };
  players.push(p);
  savePlayers(teamId, players);
  return p;
}

module.exports = { loadPlayers, savePlayers, addPlayer };
