// 设置工具栏显示 S
chrome.action.setBadgeText({ text: "S" });
chrome.action.setBadgeBackgroundColor({ color: "#4b6ef6" });

// 监听 popup 发送的抓取请求
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === "scrape") {
    // 在当前活动页面执行 content.js 里的抓取逻辑
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
    sendResponse({ status: "started" });
  }
});