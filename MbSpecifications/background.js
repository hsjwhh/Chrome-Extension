// 设置工具栏显示 S
chrome.action.setBadgeText({ text: "S" });
chrome.action.setBadgeBackgroundColor({ color: "#4b6ef6" });

// 各网站对应的 parser 文件 和 全局函数名
const PARSER_MAP = [
  {
    match: host => host.includes("supermicro.com"),
    file: "parsers/supermicro.js",
    exportName: "parseSupermicro"
  },
  {
    match: host => host.includes("gigabyte.cn"),
    file: "parsers/gigabyte.js",
    exportName: "parseGigabyte"
  }
];

// 防止同一个 tab 重复注入（tab 关闭后自动清理）
const injectedTabs = new Set();

chrome.tabs.onRemoved.addListener(tabId => {
  injectedTabs.delete(tabId);
});

// tab 导航到新页面时，清除注入记录，允许在新页面重新抓取
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    injectedTabs.delete(tabId);
  }
});

// 监听 popup 发送的抓取请求
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "scrape") {

    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // 防止重复注入
      if (injectedTabs.has(tab.id)) {
        sendResponse({ status: "already_running" });
        return;
      }

      // 在 background 侧判断 host，选择对应 parser
      const url = new URL(tab.url);
      const parserEntry = PARSER_MAP.find(p => p.match(url.hostname));

      if (!parserEntry) {
        sendResponse({ status: "unsupported_site" });
        return;
      }

      injectedTabs.add(tab.id);

      try {
        // 先注入 parser（挂载全局函数），再注入 content.js（调用它）
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [parserEntry.file]
        });

        // 把选中的 exportName 传给 content.js，通过 window 中转
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (exportName) => { window.__scraper_parser_name__ = exportName; },
          args: [parserEntry.exportName]
        });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });

        sendResponse({ status: "started" });
      } catch (e) {
        // 注入失败时移除记录，允许用户重试
        injectedTabs.delete(tab.id);
        sendResponse({ status: "error", message: e.message });
      }
    })();

    return true; // 必须保留：告知 Chrome 将异步调用 sendResponse
  }
});
