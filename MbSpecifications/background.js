// 初始化存储访问级别 (MV3 必需)
// 确保在 Service Worker 启动时立即设置
chrome.storage.session.setAccessLevel?.({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

let authCache = new Map();
const STORAGE_KEYS = {
  tokenPrefix: "mbScraper.token."
};

function normalizeModel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getConfigKey(config) {
  return JSON.stringify({
    baseUrl: config.baseUrl,
    username: config.username
  });
}

function getTokenStorageKey(config) {
  return STORAGE_KEYS.tokenPrefix + btoa(
    unescape(encodeURIComponent(getConfigKey(config)))
  );
}

function normalizeConfig(config) {
  const baseUrl = String(config?.baseUrl || "").trim().replace(/\/+$/, "");
  const username = String(config?.username || "").trim();
  const password = String(config?.password || "");

  if (!baseUrl) throw new Error("missing_base_url");
  if (!username) throw new Error("missing_username");

  return { baseUrl, username, password };
}

async function apiRequest(baseUrl, path, options = {}) {
  try {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const err = new Error(data?.message || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return data;
  } catch (e) {
    console.error(`[API Error] ${path}:`, e);
    // 明确区分网络错误和 API 业务错误
    const finalErr = new Error(e.message === 'Failed to fetch' 
      ? `无法连接到 API 服务器 (${baseUrl})，请检查网络或后端状态。`
      : e.message);
    finalErr.status = e.status;
    throw finalErr;
  }
}

function storageSessionGet(keys) {
  return new Promise(resolve => {
    chrome.storage.session.get(keys, resolve);
  });
}

function storageSessionSet(value) {
  return new Promise(resolve => {
    chrome.storage.session.set(value, resolve);
  });
}

function storageSessionRemove(keys) {
  return new Promise(resolve => {
    chrome.storage.session.remove(keys, resolve);
  });
}

async function getAccessToken(configInput) {
  const config = normalizeConfig(configInput);
  const cacheKey = getConfigKey(config);
  const storageKey = getTokenStorageKey(config);
  const now = Date.now();
  let cached = authCache.get(cacheKey);

  if (!cached) {
    const sessionData = await storageSessionGet([storageKey]);
    cached = sessionData[storageKey] || null;
    if (cached) authCache.set(cacheKey, cached);
  }

  if (cached?.accessToken && cached.expiresAt > now + 10_000) {
    return cached.accessToken;
  }

  if (!config.password) {
    throw new Error("auth_required");
  }

  const data = await apiRequest(config.baseUrl, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: config.username,
      password: config.password
    })
  });

  const nextCache = {
    accessToken: data.accessToken,
    expiresAt: now + 14 * 60 * 1000
  };

  authCache.set(cacheKey, nextCache);
  await storageSessionSet({ [storageKey]: nextCache });

  return data.accessToken;
}

async function authorizedRequest(config, path, options = {}) {
  const normalized = normalizeConfig(config);

  async function attempt(isRetry) {
    const token = await getAccessToken(normalized);
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    try {
      return await apiRequest(normalized.baseUrl, path, { ...options, headers });
    } catch (e) {
      if (e.status === 401 && !isRetry) {
        const cacheKey = getConfigKey(normalized);
        const storageKey = getTokenStorageKey(normalized);
        authCache.delete(cacheKey);
        await storageSessionRemove([storageKey]);
        return attempt(true);
      }
      throw e;
    }
  }

  return attempt(false);
}

async function checkMotherboard(payload) {
  const config = normalizeConfig(payload?.apiConfig);
  const model = String(payload?.model || "").trim();
  if (!model) throw new Error("missing_model");
  if (model.length < 4) throw new Error("model_too_short");

  const results = await authorizedRequest(
    config,
    `/api/hw/mb?keyword=${encodeURIComponent(model)}`
  );

  const targetModel = normalizeModel(model);
  const targetUrl = String(payload?.url || "").trim();
  const existing = Array.isArray(results)
    ? results.find(item => {
      const val = typeof item === 'string' ? item : item?.model;
      const url = typeof item === 'string' ? null : item?.url;
      return normalizeModel(val) === targetModel || (targetUrl && url === targetUrl);
    }) || null
    : null;

  return {
    exists: Boolean(existing),
    existing: typeof existing === 'string' ? { model: existing } : existing,
    candidates: Array.isArray(results) ? results : []
  };
}

async function createMotherboard(payload) {
  const config = normalizeConfig(payload?.apiConfig);
  return authorizedRequest(config, "/api/hw/mb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload.data)
  });
}

async function checkCpu(payload) {
  const config = normalizeConfig(payload?.apiConfig);
  const cpuSName = normalizeModel(payload?.cpu_s_name);
  if (!cpuSName) throw new Error("missing_cpu_name");
  if (cpuSName.length < 4) throw new Error("cpu_name_too_short");

  const results = await authorizedRequest(
    config,
    `/api/hw/cpu/s-name?keyword=${encodeURIComponent(cpuSName)}`
  );

  const existing = Array.isArray(results)
    ? results.find(item => {
      const sName = typeof item === 'string' ? item : item?.cpu_s_name;
      const fullName = typeof item === 'string' ? null : item?.cpu_name;
      return normalizeModel(sName) === cpuSName || normalizeModel(fullName) === cpuSName;
    }) || null
    : null;

  return {
    exists: Boolean(existing),
    existing: typeof existing === 'string' ? { cpu_s_name: existing } : existing,
    candidates: Array.isArray(results) ? results : []
  };
}

async function createCpu(payload) {
  const config = normalizeConfig(payload?.apiConfig);
  return authorizedRequest(config, "/api/hw/cpu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload.data)
  });
}

async function clearAuthCache(configInput) {
  const config = normalizeConfig(configInput);
  const cacheKey = getConfigKey(config);
  const storageKey = getTokenStorageKey(config);
  authCache.delete(cacheKey);
  await storageSessionRemove([storageKey]);
}

// 各网站对应的 parser 文件和全局函数名
const PARSER_MAP = [
  {
    match: (host, path) =>
      host.includes("asus.com") &&
      path.includes("/motherboards-components/motherboards/"),
    file: "parsers/asus.js",
    exportName: "parseAsus"
  },
  {
    match: (host, path) =>
      host.includes("supermicro") &&
      path.startsWith("/en/products/motherboard"),
    file: "parsers/supermicro.js",
    exportName: "parseSupermicro"
  },
  {
    match: (host, path) =>
      host.includes("gigabyte.cn") &&
      path.startsWith("/Enterprise/Server-Motherboard"),
    file: "parsers/gigabyte.js",
    exportName: "parseGigabyte"
  },
  {
    match: (host, path) =>
      host.includes("aorus.com") &&
      path.includes("/motherboards/"),
    file: "parsers/aorus.js",
    exportName: "parseAorus"
  },
  {
    match: (host, path) =>
      /intel\.(cn|com)$/.test(host) &&
      (path.includes("/products/") || path.includes("/ark/") || path.includes("/content/www/")),
    file: "parsers/intel.js",
    exportName: "parseIntel"
  }
];

// ─── 批量抓取控制器 ──────────────────────────────────────────────────────────
class BatchScraper {
  constructor() {
    this.queue = [];
    this.results = [];
    this.workerTabId = null;
    this.isScraping = false;
    this.sourceTabId = null; // 发起抓取的列表页 Tab ID
    this.currentIndex = 0;
    this.mappingConfig = null;
    this.apiConfig = null;
    
    // 绑定事件处理器
    this.handleMessage = this.handleMessage.bind(this);
    this.handleTabUpdate = this.handleTabUpdate.bind(this);
    this.handleTabRemove = this.handleTabRemove.bind(this);
    
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate);
    chrome.tabs.onRemoved.addListener(this.handleTabRemove);
  }

  async start(links, sourceTabId) {
    if (this.isScraping) return { ok: false, reason: 'Already scraping' };
    
    this.queue = links;
    this.results = new Array(links.length).fill(null);
    this.sourceTabId = sourceTabId;
    this.currentIndex = 0;
    this.isScraping = true;

    // 创建一个后台标签页用于抓取
    const tab = await chrome.tabs.create({ active: false, url: 'about:blank' });
    this.workerTabId = tab.id;

    this.processNext();
    return { ok: true };
  }

  stop() {
    this.isScraping = false;
    if (this.workerTabId) {
      chrome.tabs.remove(this.workerTabId).catch(() => {});
      this.workerTabId = null;
    }
    this.queue = [];
    this.sourceTabId = null;
  }

  async processNext() {
    if (!this.isScraping) return;

    if (this.currentIndex >= this.queue.length) {
      this.finish();
      return;
    }

    const item = this.queue[this.currentIndex];
    
    // 通知 UI 更新状态: Fetching
    this.notifyProgress(this.currentIndex, 'Fetching...', 'active');

    if (this.workerTabId) {
      await chrome.tabs.update(this.workerTabId, { url: item.url });
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    if (tabId !== this.workerTabId || changeInfo.status !== 'complete') return;

    // 轮询等待各厂商规格表渲染完毕，每 300ms 检查一次，最多等 8 秒
    const READY_SELECTORS = {
      'supermicro': '.spec-table-1, .key-feature-list',
      'gigabyte':   '#Section-Specifications .SpecItem',
      'aorus':      '.tableDataBox',
      'asus':       '.spec-section, .techspec-table',
      'intel':      '.spec-label, .specs-section',
    };
    const POLL_INTERVAL = 300;
    const POLL_TIMEOUT  = 8000;

    await (async () => {
      let selector = null;
      try {
        const url = new URL(tab.url);
        for (const [key, sel] of Object.entries(READY_SELECTORS)) {
          if (url.hostname.includes(key)) { selector = sel; break; }
        }
      } catch (_) {}

      if (!selector) {
        await new Promise(r => setTimeout(r, 1500));
        return;
      }

      const deadline = Date.now() + POLL_TIMEOUT;
      while (Date.now() < deadline) {
        const found = await chrome.scripting.executeScript({
          target: { tabId: this.workerTabId },
          func: (sel) => !!document.querySelector(sel),
          args: [selector]
        }).then(r => r[0]?.result).catch(() => false);
        if (found) return;
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
      }
    })();

    try {
      // 1. 注入解析器代码
      const url = new URL(tab.url);
      const entry = PARSER_MAP.find(p => p.match(url.hostname, url.pathname));
      
      if (!entry) throw new Error("No parser match");

      await chrome.scripting.executeScript({
        target: { tabId: this.workerTabId },
        files: [entry.file]
      });

      // 2. 执行解析
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.workerTabId },
        func: (exportName) => {
          // 在页面上下文中执行
          const fn = window[exportName];
          return fn ? fn() : null;
        },
        args: [entry.exportName]
      });

      const data = results[0]?.result;
      if (!data) throw new Error("Parse returned null");

      this.results[this.currentIndex] = data;
      this.notifyProgress(this.currentIndex, 'Done', 'success', data);

    } catch (e) {
      console.error('Batch error:', e);
      this.notifyProgress(this.currentIndex, 'Error', 'error', null, e.message);
    }

    // 无论成功失败，继续下一个
    this.currentIndex++;
    // 随机延迟防封 (1s)
    setTimeout(() => this.processNext(), 1000);
  }

  handleTabRemove(tabId) {
    if (tabId === this.workerTabId && this.isScraping) {
      // 用户意外关闭了抓取窗口，停止任务
      this.stop();
      // 通知 UI 任务被中断
      if (this.sourceTabId) {
        chrome.tabs.sendMessage(this.sourceTabId, {
          action: 'batchAborted',
          reason: 'Worker tab closed'
        }).catch(() => {});
      }
    }
  }

  finish() {
    this.isScraping = false;
    if (this.workerTabId) {
      chrome.tabs.remove(this.workerTabId).catch(() => {});
      this.workerTabId = null;
    }
    
    if (this.sourceTabId) {
      chrome.tabs.sendMessage(this.sourceTabId, {
        action: 'batchComplete',
        results: this.results
      }).catch(() => {});
    }
  }

  notifyProgress(index, statusText, statusType, data = null, error = null) {
    if (this.sourceTabId) {
      chrome.tabs.sendMessage(this.sourceTabId, {
        action: 'batchProgress',
        index,
        total: this.queue.length,
        statusText,
        statusType,
        data,
        error
      }).catch(() => {});
    }
  }

  handleMessage(msg, sender, sendResponse) {
    if (msg.action === "startBatchScrape") {
      this.start(msg.links, sender.tab.id, msg.apiConfig, msg.mappingConfig).then(res => sendResponse(res));
      return true;
    }
    if (msg.action === "stopBatchScrape") {
      this.stop();
      sendResponse({ ok: true });
      return true;
    }
  }
}

const batchScraper = new BatchScraper();

// ─── 消息监听聚合 ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 优先处理批量任务消息
  if (msg.action === "startBatchScrape" || msg.action === "stopBatchScrape") {
    return batchScraper.handleMessage(msg, sender, sendResponse);
  }

  if (msg.action === "injectParser") {
    (async () => {
      const tabId = sender.tab.id;
      const url = new URL(sender.tab.url);
      const entry = PARSER_MAP.find(p => p.match(url.hostname, url.pathname));

      if (!entry) {
        sendResponse({ ok: false, reason: "unsupported_page" });
        return;
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: [entry.file]
        });
        sendResponse({ ok: true, exportName: entry.exportName });
      } catch (e) {
        sendResponse({ ok: false, reason: e.message });
      }
    })();
    return true;
  }

  if (msg.action === "checkMotherboard") {
    (async () => {
      try {
        const data = await checkMotherboard(msg.payload);
        sendResponse({ ok: true, ...data });
      } catch (e) {
        sendResponse({ ok: false, reason: e.message || "check_failed" });
      }
    })();
    return true;
  }

  if (msg.action === "createMotherboard") {
    (async () => {
      try {
        const data = await createMotherboard(msg.payload);
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, reason: e.message || "create_failed" });
      }
    })();
    return true;
  }

  if (msg.action === "checkCpu") {
    (async () => {
      try {
        const data = await checkCpu(msg.payload);
        sendResponse({ ok: true, ...data });
      } catch (e) {
        sendResponse({ ok: false, reason: e.message || "check_failed" });
      }
    })();
    return true;
  }

  if (msg.action === "createCpu") {
    (async () => {
      try {
        const data = await createCpu(msg.payload);
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, reason: e.message || "create_failed" });
      }
    })();
    return true;
  }

  if (msg.action === "clearAuthCache") {
    (async () => {
      try {
        await clearAuthCache(msg.payload?.apiConfig);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, reason: e.message || "clear_auth_failed" });
      }
    })();
    return true;
  }
});
