Page({
  go(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.switchTab({ url });
//    wx.navigateTo({ url });
  }
});
