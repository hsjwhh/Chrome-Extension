// 设置工具栏显示 S
chrome.action.setBadgeText({ text: "S" });
chrome.action.setBadgeBackgroundColor({ color: "#4b6ef6" });

// 监听 popup 发送的抓取请求
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scrape") {

    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      sendResponse({ status: "started" });
    })();

    return true; // 必须！告诉 Chrome：我会异步调用 sendResponse
  }
});
