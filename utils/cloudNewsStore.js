// utils/cloudNewsStore.js
// 云端存储联赛新闻

const db = wx.cloud.database();
const COL = db.collection("news");

function nowTs() {
  return Date.now();
}

// 拉取最近的新闻，按时间倒序
async function fetchLatestNews(limit = 20) {
  const res = await COL
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return res.data || [];
}

// 新建或更新一条新闻
async function saveNews({ id, title, content }) {
  const t = nowTs();
  if (!title || !content) {
    throw new Error("Missing title/content");
  }

  if (id) {
    await COL.doc(id).update({
      data: {
        title,
        content,
        updatedAt: t
      }
    });
    return { id };
  }

  const res = await COL.add({
    data: {
      title,
      content,
      createdAt: t,
      updatedAt: t
    }
  });
  return { id: res._id };
}

async function deleteNews(id) {
  if (!id) return false;
  await COL.doc(id).remove();
  return true;
}

module.exports = {
  fetchLatestNews,
  saveNews,
  deleteNews
};

