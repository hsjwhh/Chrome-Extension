// 各网站对应的 parser 文件和全局函数名
const PARSER_MAP = [
  {
    match: (host, path) =>
      host.includes("supermicro") &&
      path.startsWith("/en/products/motherboard/"),
    file: "parsers/supermicro.js",
    exportName: "parseSupermicro"
  },
  {
    match: (host, path) =>
      host.includes("gigabyte.cn") &&
      path.startsWith("/Enterprise/Server-Motherboard/"),
    file: "parsers/gigabyte.js",
    exportName: "parseGigabyte"
  }
];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "injectParser") return;

  (async () => {
    const tabId = sender.tab.id;
    const url   = new URL(sender.tab.url);
    const entry = PARSER_MAP.find(p => p.match(url.hostname, url.pathname));

    if (!entry) {
      sendResponse({ ok: false, reason: "unsupported_page" });
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files:  [entry.file]
      });
      sendResponse({ ok: true, exportName: entry.exportName });
    } catch (e) {
      sendResponse({ ok: false, reason: e.message });
    }
  })();

  return true;
});
