// utils/schedule.js
const STORAGE_KEY = "schedule_list";

function loadBundledScheduleData() {
  const list = require("../data/scheduleData"); // data/scheduleData.js
  console.log("loadBundledScheduleData length =", Array.isArray(list) ? list.length : "not array");
  return Array.isArray(list) ? list : [];
}

async function ensureScheduleLoaded() {
  const cached = wx.getStorageSync(STORAGE_KEY);
  if (Array.isArray(cached) && cached.length > 0) return cached;

  const list = loadBundledScheduleData();
  wx.setStorageSync(STORAGE_KEY, list);
  return list;
}

function loadSchedule() {
  return wx.getStorageSync(STORAGE_KEY) || [];
}

function saveSchedule(list) {
  wx.setStorageSync(STORAGE_KEY, list || []);
}

module.exports = {
  ensureScheduleLoaded,
  loadSchedule,
  saveSchedule
};