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
        // 清除缓存，下次 getAccessToken 会重新登录
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
  if (!model) {
    throw new Error("missing_model");
  }
  if (model.length < 4) {
    throw new Error("model_too_short");
  }

  const results = await authorizedRequest(
    config,
    `/api/hw/mb?keyword=${encodeURIComponent(model)}`
  );

  const targetModel = normalizeModel(model);
  const targetUrl = String(payload?.url || "").trim();
  const existing = Array.isArray(results)
    ? results.find(item =>
      normalizeModel(item?.model) === targetModel ||
      (targetUrl && String(item?.url || "").trim() === targetUrl)
    ) || null
    : null;

  return {
    exists: Boolean(existing),
    existing,
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
  if (!cpuSName) {
    throw new Error("missing_cpu_name");
  }
  if (cpuSName.length < 4) {
    throw new Error("cpu_name_too_short");
  }

  const results = await authorizedRequest(
    config,
    `/api/hw/cpu?keyword=${encodeURIComponent(cpuSName)}`
  );

  const existing = Array.isArray(results)
    ? results.find(item =>
      normalizeModel(item?.cpu_s_name) === cpuSName ||
      normalizeModel(item?.cpu_name) === cpuSName
    ) || null
    : null;

  return {
    exists: Boolean(existing),
    existing,
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
      path.includes("/motherboards-components/motherboards/") &&
      /\/techspec\/?$/.test(path),
    file: "parsers/asus.js",
    exportName: "parseAsus"
  },
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
  },
  {
    match: (host, path) =>
      host.includes("aorus.com") &&
      path.includes("/motherboards/") &&
      path.endsWith("/Specification"),
    file: "parsers/aorus.js",
    exportName: "parseAorus"
  },
  {
    match: (host, path) =>
      /intel\.(cn|com)$/.test(host) &&
      path.includes("/ark/products/"),
    file: "parsers/intel.js",
    exportName: "parseIntel"
  }
];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
