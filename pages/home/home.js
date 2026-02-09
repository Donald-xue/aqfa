const { fetchLatestNews, saveNews, deleteNews } = require("../../utils/cloudNewsStore");

Page({
  data: {
    newsList: [],
    newsTitle: "",
    newsContent: "",
    newsEditingId: "",
    showNewsForm: false
  },

  async onShow() {
    await this.refreshNews();
  },

  async refreshNews() {
    try {
      const list = await fetchLatestNews(20);
      const newsList = (list || []).map(n => {
        const ts = Number(n.createdAt || n.updatedAt || 0);
        let dateText = "";
        if (ts) {
          const d = new Date(ts);
          const y = d.getFullYear();
          const m = (d.getMonth() + 1).toString().padStart(2, "0");
          const day = d.getDate().toString().padStart(2, "0");
          dateText = `${y}-${m}-${day}`;
        }
        return {
          _id: n._id,
          title: n.title || "",
          content: n.content || "",
          dateText
        };
      });
      this.setData({ newsList });
    } catch (err) {
      console.error("refreshNews error:", err);
    }
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.switchTab({ url });
//    wx.navigateTo({ url });
  },

  onNewsTitleInput(e) {
    this.setData({ newsTitle: e.detail.value });
  },

  onNewsContentInput(e) {
    this.setData({ newsContent: e.detail.value });
  },

  onAddNewsTap() {
    this.setData({
      showNewsForm: true,
      newsEditingId: "",
      newsTitle: "",
      newsContent: ""
    });
  },

  onEditNewsTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const item = (this.data.newsList || []).find(x => x._id === id);
    if (!item) return;
    this.setData({
      showNewsForm: true,
      newsEditingId: id,
      newsTitle: item.title,
      newsContent: item.content
    });
  },

  onCancelNews() {
    this.setData({
      showNewsForm: false,
      newsEditingId: "",
      newsTitle: "",
      newsContent: ""
    });
  },

  async onSubmitNews() {
    const title = (this.data.newsTitle || "").trim();
    const content = (this.data.newsContent || "").trim();
    const id = this.data.newsEditingId || "";

    if (!title) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }
    if (!content) {
      wx.showToast({ title: "请输入正文", icon: "none" });
      return;
    }

    try {
      wx.showLoading({ title: "保存中" });
      await saveNews({ id, title, content });
      wx.showToast({ title: "已保存", icon: "success" });
      this.setData({
        showNewsForm: false,
        newsEditingId: "",
        newsTitle: "",
        newsContent: ""
      });
      await this.refreshNews();
    } catch (err) {
      console.error("onSubmitNews error:", err);
      wx.showToast({ title: "保存失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  onDeleteNewsTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.showModal({
      title: "删除新闻",
      content: "确定要删除这条新闻吗？",
      success: async (res) => {
        if (!res.confirm) return;
        try {
          wx.showLoading({ title: "删除中" });
          await deleteNews(id);
          wx.showToast({ title: "已删除", icon: "success" });
          await this.refreshNews();
        } catch (err) {
          console.error("onDeleteNewsTap error:", err);
          wx.showToast({ title: "删除失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      }
    });
  }
});
