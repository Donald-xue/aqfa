//App({})
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("Please use WeChat base lib >= 2.2.3");
      return;
    }
    wx.cloud.init({
      env: "cloud1-1gijyc9ne4244500", // ←替换成你的 CloudBase 环境ID
      traceUser: true,
    });
  }
});
