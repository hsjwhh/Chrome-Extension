(function () {
  // 防止重复注入（SPA 页面跳转时 content_scripts 不会重新执行，但保险起见保留）
  if (document.getElementById('__scraper_bar__')) return;

  const FIELD_CONFIG = [
    { apiKey: 'model', label: '主板型号', sourceKey: 'Model' },
    { apiKey: 'product_collection', label: '产品系列', sourceKey: 'CPU类型', multiline: true },
    { apiKey: 'sockets', label: 'CPU接口', sourceKey: 'CPU接口' },
    { apiKey: 'cpu_number', label: 'CPU路数', sourceKey: '几路CPU' },
    { apiKey: 'max_tdp', label: '最大TDP', sourceKey: '最大TDP' },
    { apiKey: 'memory_type', label: '内存类型', sourceKey: '内存类型', multiline: true },
    { apiKey: 'dimm_number', label: 'DIMM数量', sourceKey: 'DIMM数量' },
    { apiKey: 'max_memory', label: '最大内存', sourceKey: '最大内存', multiline: true },
    { apiKey: 'pcie_number', label: 'PCI槽数量', sourceKey: 'PCI槽数量' },
    { apiKey: 'pcie_list', label: 'PCI分布', sourceKey: 'PCI分布', multiline: true },
    { apiKey: 'm2', label: 'M.2', sourceKey: 'M2', multiline: true },
    { apiKey: 'input', label: '存储接口', sourceKey: '存储接口', multiline: true },
    { apiKey: 'url', label: '页面URL', sourceKey: 'URL', multiline: true }
  ];
  const CPU_FIELD_CONFIG = [
    { apiKey: 'cpu_s_name', label: '标准化型号', sourceKey: '__cpu_s_name' },
    { apiKey: 'cpu_short_name', label: 'CPU简称', sourceKey: '__cpu_short_name' },
    { apiKey: 'cpu_name', label: 'CPU名称', sourceKey: 'cpu_name', multiline: true },
    { apiKey: 'release_date', label: '发行日期', sourceKey: 'release_date' },
    { apiKey: 'cores', label: '内核数', sourceKey: 'cores' },
    { apiKey: 'max_turbo', label: '最大睿频频率', sourceKey: 'max_turbo' },
    { apiKey: 'base_freq', label: '处理器基本频率', sourceKey: 'base_freq' },
    { apiKey: 'cache', label: '缓存', sourceKey: 'cache' },
    { apiKey: 'tdp', label: 'TDP', sourceKey: 'tdp' },
    { apiKey: 'memory_channels', label: '内存通道数', sourceKey: 'memory_channels' },
    { apiKey: 'memory_speed', label: '内存频率', sourceKey: 'memory_speed', multiline: true },
    { apiKey: 'max_memory_speed', label: '最大内存频率', sourceKey: 'max_memory_speed' },
    { apiKey: 'max_memory_capacity', label: '最大内存容量', sourceKey: 'max_memory_capacity' },
    { apiKey: 'ecc_support', label: 'ECC支持', sourceKey: 'ecc_support' },
    { apiKey: 'socket', label: '封装', sourceKey: 'socket' },
    { apiKey: 'pci', label: 'PCI信息', sourceKey: 'pci' },
    { apiKey: 'scalability', label: '可扩展性', sourceKey: 'scalability' }
  ];
  const DEFAULT_API_BASE_URL = 'http://localhost:3000';
  const STORAGE_KEYS = {
    baseUrl: 'mbScraper.apiBaseUrl',
    username: 'mbScraper.apiUsername'
  };

  // ─── 样式 ────────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #__scraper_bar__ {
      all: initial;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      background: #0f1117;
      border-bottom: 2px solid #4b6ef6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #c9d1e0;
      position: sticky;
      top: 0;
      z-index: 2147483647;
      box-sizing: border-box;
      width: 100%;
    }
    #__scraper_bar__ .scraper-label {
      font-weight: 600;
      letter-spacing: 0.04em;
      color: #4b6ef6;
      flex-shrink: 0;
    }
    #__scraper_bar__ .scraper-model {
      color: #e2e8f0;
      font-weight: 500;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #__scraper_bar__ .scraper-btn {
      all: initial;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 14px;
      border-radius: 5px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #__scraper_bar__ .scraper-btn:hover  { opacity: 0.85; }
    #__scraper_bar__ .scraper-btn:active { transform: scale(0.96); }
    #__scraper_bar__ .scraper-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }
    #__scraper_bar__ .btn-csv {
      background: #4b6ef6;
      color: #fff;
    }
    #__scraper_bar__ .btn-copy {
      background: #1e293b;
      color: #94a3b8;
      border: 1px solid #334155;
    }
    #__scraper_bar__ .btn-check {
      background: #0f766e;
      color: #ecfeff;
      border: 1px solid #115e59;
    }
    #__scraper_bar__ .scraper-status {
      font-size: 12px;
      color: #64748b;
      margin-left: 4px;
    }
    #__scraper_bar__ .scraper-status.ok  { color: #34d399; }
    #__scraper_bar__ .scraper-status.err { color: #f87171; }
    #__scraper_modal_mask__ {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      z-index: 2147483646;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    #__scraper_modal__ {
      width: min(900px, 100%);
      max-height: min(80vh, 900px);
      overflow: auto;
      background: #ffffff;
      color: #0f172a;
      border-radius: 14px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #__scraper_modal__ * {
      box-sizing: border-box;
    }
    #__scraper_modal__ .modal-head {
      padding: 20px 24px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    #__scraper_modal__ .modal-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    #__scraper_modal__ .modal-desc {
      margin: 8px 0 0;
      color: #475569;
      font-size: 13px;
      line-height: 1.5;
    }
    #__scraper_modal__ .modal-body {
      padding: 20px 24px;
      display: grid;
      gap: 14px;
    }
    #__scraper_modal__ .map-row {
      display: grid;
      grid-template-columns: 140px 1fr 1.2fr;
      gap: 12px;
      align-items: start;
    }
    #__scraper_modal__ .map-label {
      padding-top: 10px;
      font-size: 13px;
      color: #0f172a;
      font-weight: 600;
    }
    #__scraper_modal__ .map-source {
      min-height: 40px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-size: 13px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    #__scraper_modal__ .map-input,
    #__scraper_modal__ .map-textarea {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      color: #0f172a;
      background: #fff;
    }
    #__scraper_modal__ .map-textarea {
      min-height: 74px;
      resize: vertical;
      font-family: inherit;
    }
    #__scraper_modal__ .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px 24px;
      border-top: 1px solid #e2e8f0;
    }
    #__scraper_modal__ .modal-btn {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 600;
      padding: 9px 16px;
      border-radius: 10px;
      cursor: pointer;
    }
    #__scraper_modal__ .modal-btn.secondary {
      background: #e2e8f0;
      color: #0f172a;
    }
    #__scraper_modal__ .modal-btn.primary {
      background: #0f766e;
      color: #fff;
    }
    #__scraper_modal__ .modal-btn.ghost {
      background: #fff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
    }
    #__scraper_modal__ .modal-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #__scraper_modal__ .modal-error {
      padding: 0 24px 16px;
      color: #b91c1c;
      font-size: 13px;
      display: none;
    }
    @media (max-width: 860px) {
      #__scraper_modal__ .map-row {
        grid-template-columns: 1fr;
      }
      #__scraper_modal__ .map-label {
        padding-top: 0;
      }
    }
    #__scraper_auth_mask__ {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      z-index: 2147483647;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      box-sizing: border-box;
    }
    #__scraper_auth__ {
      width: min(440px, 100%);
      background: #ffffff;
      color: #0f172a;
      border-radius: 14px;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    }
    #__scraper_auth__ .auth-head {
      padding: 20px 24px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    #__scraper_auth__ .auth-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }
    #__scraper_auth__ .auth-desc {
      margin: 8px 0 0;
      color: #475569;
      font-size: 13px;
      line-height: 1.5;
    }
    #__scraper_auth__ .auth-body {
      padding: 20px 24px;
      display: grid;
      gap: 14px;
    }
    #__scraper_auth__ .auth-field {
      display: grid;
      gap: 6px;
    }
    #__scraper_auth__ .auth-label {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
    }
    #__scraper_auth__ .auth-input {
      width: 100%;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 13px;
      color: #0f172a;
      background: #fff;
    }
    #__scraper_auth__ .auth-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 24px 24px;
      border-top: 1px solid #e2e8f0;
    }
    #__scraper_auth__ .auth-error {
      padding: 0 24px 16px;
      color: #b91c1c;
      font-size: 13px;
      display: none;
    }
  `;
  document.head.appendChild(style);

  // ─── 顶栏 DOM ────────────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = '__scraper_bar__';
  bar.innerHTML = `
    <span class="scraper-label">⬡ Scraper</span>
    <span class="scraper-model" id="__scraper_model__">—</span>
    <button class="scraper-btn btn-csv"  id="__scraper_csv__">↓ 导出 CSV</button>
    <button class="scraper-btn btn-copy" id="__scraper_copy__">⎘ 复制一行</button>
    <button class="scraper-btn btn-check" id="__scraper_check__">⇄ 检查入库</button>
    <span  class="scraper-status"        id="__scraper_status__"></span>
  `;

  // 插到 body 最前面（保证 sticky 生效）
  document.body.insertBefore(bar, document.body.firstChild);

  const modelEl  = document.getElementById('__scraper_model__');
  const csvBtn   = document.getElementById('__scraper_csv__');
  const copyBtn  = document.getElementById('__scraper_copy__');
  const checkBtn = document.getElementById('__scraper_check__');
  const statusEl = document.getElementById('__scraper_status__');

  const modalMask = document.createElement('div');
  modalMask.id = '__scraper_modal_mask__';
  modalMask.innerHTML = `
    <div id="__scraper_modal__" role="dialog" aria-modal="true" aria-labelledby="__scraper_modal_title__">
      <div class="modal-head">
        <h2 class="modal-title" id="__scraper_modal_title__">主板映射审核</h2>
        <p class="modal-desc">库中未找到当前主板。请确认抓取字段与入库字段的映射，必要时可以直接修改后再提交。</p>
      </div>
      <div class="modal-body" id="__scraper_modal_body__"></div>
      <div class="modal-error" id="__scraper_modal_error__"></div>
      <div class="modal-actions">
        <button class="modal-btn secondary" id="__scraper_modal_cancel__">取消</button>
        <button class="modal-btn primary" id="__scraper_modal_confirm__">确认写库</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalMask);

  const modalBody = document.getElementById('__scraper_modal_body__');
  const modalError = document.getElementById('__scraper_modal_error__');
  const modalCancelBtn = document.getElementById('__scraper_modal_cancel__');
  const modalConfirmBtn = document.getElementById('__scraper_modal_confirm__');

  const authMask = document.createElement('div');
  authMask.id = '__scraper_auth_mask__';
  authMask.innerHTML = `
    <div id="__scraper_auth__" role="dialog" aria-modal="true" aria-labelledby="__scraper_auth_title__">
      <div class="auth-head">
        <h2 class="auth-title" id="__scraper_auth_title__">API 认证</h2>
        <p class="auth-desc">请输入 API 地址、用户名和密码。扩展只会长期保存 API 地址和用户名，密码不会被持久化保存。</p>
      </div>
      <div class="auth-body">
        <label class="auth-field">
          <span class="auth-label">API 地址</span>
          <input class="auth-input" id="__scraper_auth_base__" value="${escapeAttr(DEFAULT_API_BASE_URL)}" placeholder="http://localhost:3000">
        </label>
        <label class="auth-field">
          <span class="auth-label">用户名</span>
          <input class="auth-input" id="__scraper_auth_user__" placeholder="请输入用户名">
        </label>
        <label class="auth-field">
          <span class="auth-label">密码</span>
          <input class="auth-input" id="__scraper_auth_pass__" type="password" placeholder="请输入密码">
        </label>
      </div>
      <div class="auth-error" id="__scraper_auth_error__"></div>
      <div class="auth-actions">
        <button class="modal-btn ghost" id="__scraper_auth_cancel__">取消</button>
        <button class="modal-btn primary" id="__scraper_auth_confirm__">继续</button>
      </div>
    </div>
  `;
  document.body.appendChild(authMask);

  const authBaseInput = document.getElementById('__scraper_auth_base__');
  const authUserInput = document.getElementById('__scraper_auth_user__');
  const authPassInput = document.getElementById('__scraper_auth_pass__');
  const authError = document.getElementById('__scraper_auth_error__');
  const authCancelBtn = document.getElementById('__scraper_auth_cancel__');
  const authConfirmBtn = document.getElementById('__scraper_auth_confirm__');

  // ─── 状态提示 ────────────────────────────────────────────────────────────────
  let statusTimer = null;
  function setStatus(msg, type = '') {
    statusEl.textContent = msg;
    statusEl.className   = 'scraper-status' + (type ? ' ' + type : '');
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(() => setStatus(''), 3000);
  }

  // ─── 解析缓存（避免重复请求 background 注入） ─────────────────────────────
  let cachedResult = null;
  let modalState = null;
  let apiConfig = {
    baseUrl: DEFAULT_API_BASE_URL,
    username: '',
    password: ''
  };
  let authResolver = null;
  const initialConfigLoad = loadSavedApiConfig();

  function setBusy(isBusy) {
    csvBtn.disabled = isBusy;
    copyBtn.disabled = isBusy;
    checkBtn.disabled = isBusy;
  }

  function normalizeKeyword(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function buildCpuShortName(cpuName) {
    const cleaned = String(cpuName || '').replace(/[®™]/g, '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    const intelCodeMatch = cleaned.match(/(?:酷睿\s*)?(i[3579])\s*(?:处理器\s*)?([a-z0-9]+)$/i);
    if (intelCodeMatch) {
      return `Intel ${intelCodeMatch[1].toLowerCase()}-${intelCodeMatch[2].toUpperCase()}`;
    }
    const intelCoreUltraMatch = cleaned.match(/core\s+ultra\s+(\d+)\s+processor\s+([a-z0-9]+)$/i);
    if (intelCoreUltraMatch) {
      return `Intel Ultra ${intelCoreUltraMatch[1]} ${intelCoreUltraMatch[2].toUpperCase()}`;
    }
    const match = cleaned.match(/^(Intel|AMD)\s+(.+)$/i);
    if (!match) return cleaned;
    const vendor = match[1].toUpperCase() === 'AMD' ? 'AMD' : 'Intel';
    let tail = match[2]
      .replace(/\bprocessor\b/ig, '')
      .replace(/\bCPU\b/ig, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!tail) return vendor;
    return `${vendor} ${tail}`;
  }

  function getEntityConfig(result) {
    if (result?.cpu_name) {
      return {
        type: 'cpu',
        label: 'CPU',
        keyField: 'cpu_name',
        keyFieldLabel: 'CPU名称',
        checkAction: 'checkCpu',
        createAction: 'createCpu',
        createSuccessText: '✓ 已写入 CPU 库',
        existsText: existing => `✓ 已存在：${existing?.cpu_name || result.cpu_name}`,
        modalTitle: 'CPU 映射审核',
        modalDesc: '库中未找到当前 CPU。请确认抓取字段与入库字段的映射，必要时可以直接修改后再提交。',
        fieldConfig: CPU_FIELD_CONFIG
      };
    }

    return {
      type: 'motherboard',
      label: '主板',
      keyField: 'model',
      keyFieldLabel: '主板型号',
      checkAction: 'checkMotherboard',
      createAction: 'createMotherboard',
      createSuccessText: '✓ 已写入主板库',
      existsText: existing => `✓ 已存在：${existing?.model || result.Model}`,
      modalTitle: '主板映射审核',
      modalDesc: '库中未找到当前主板。请确认抓取字段与入库字段的映射，必要时可以直接修改后再提交。',
      fieldConfig: FIELD_CONFIG
    };
  }

  function toApiPayload(result, entityConfig) {
    const payload = {};
    entityConfig.fieldConfig.forEach(field => {
      payload[field.apiKey] = result[field.sourceKey] || '';
    });
    return payload;
  }

  function openModal(payload, result, entityConfig) {
    modalState = { payload, result, entityConfig };
    document.getElementById('__scraper_modal_title__').textContent = entityConfig.modalTitle;
    document.querySelector('#__scraper_modal__ .modal-desc').textContent = entityConfig.modalDesc;
    modalBody.innerHTML = entityConfig.fieldConfig.map(field => {
      const sourceValue = result[field.sourceKey] || '';
      const inputValue = payload[field.apiKey] || '';
      const control = field.multiline
        ? `<textarea class="map-textarea" data-api-key="${field.apiKey}">${escapeHtml(inputValue)}</textarea>`
        : `<input class="map-input" data-api-key="${field.apiKey}" value="${escapeAttr(inputValue)}">`;

      return `
        <div class="map-row">
          <div class="map-label">${escapeHtml(field.label)}<br><span style="color:#64748b;font-weight:500">${escapeHtml(field.apiKey)}</span></div>
          <div class="map-source">${escapeHtml(sourceValue || '—')}</div>
          <div>${control}</div>
        </div>
      `;
    }).join('');

    modalError.style.display = 'none';
    modalError.textContent = '';
    modalConfirmBtn.disabled = false;
    modalCancelBtn.disabled = false;
    modalMask.style.display = 'flex';
  }

  function closeModal() {
    modalState = null;
    modalMask.style.display = 'none';
    modalBody.innerHTML = '';
    modalError.style.display = 'none';
    modalError.textContent = '';
  }

  function collectModalPayload() {
    const payload = {};
    modalBody.querySelectorAll('[data-api-key]').forEach(el => {
      payload[el.dataset.apiKey] = el.value.trim();
    });
    return payload;
  }

  function showModalError(message) {
    modalError.textContent = message;
    modalError.style.display = 'block';
  }

  function openAuthModal() {
    authBaseInput.value = apiConfig.baseUrl || DEFAULT_API_BASE_URL;
    authUserInput.value = apiConfig.username || '';
    authPassInput.value = '';
    authError.style.display = 'none';
    authError.textContent = '';
    authMask.style.display = 'flex';
    setTimeout(() => authUserInput.focus(), 0);
  }

  function closeAuthModal() {
    authMask.style.display = 'none';
    authError.style.display = 'none';
    authError.textContent = '';
  }

  function showAuthError(message) {
    authError.textContent = message;
    authError.style.display = 'block';
  }

  function hasApiConfig() {
    return Boolean(
      String(apiConfig.baseUrl || '').trim() &&
      String(apiConfig.username || '').trim()
    );
  }

  function getApiConfig() {
    return {
      baseUrl: String(apiConfig.baseUrl || '').trim(),
      username: String(apiConfig.username || '').trim(),
      password: String(apiConfig.password || '')
    };
  }

  async function ensureApiConfig(forcePrompt = false) {
    await initialConfigLoad;

    if (!forcePrompt && hasApiConfig()) return getApiConfig();

    return new Promise((resolve, reject) => {
      authResolver = { resolve, reject };
      openAuthModal();
    });
  }

  async function sendAuthorizedMessage(action, payloadFactory) {
    let currentApiConfig = await ensureApiConfig(false);
    let resp = await chrome.runtime.sendMessage({
      action,
      payload: payloadFactory(currentApiConfig)
    });

    if (resp?.ok || resp?.reason !== 'auth_required') {
      return resp;
    }

    // token 失效，清除密码并强制弹出认证框
    apiConfig.password = '';
    try {
      currentApiConfig = await ensureApiConfig(true);
    } catch (e) {
      // 用户取消了认证框
      return { ok: false, reason: e.message || 'auth_cancelled' };
    }

    return chrome.runtime.sendMessage({
      action,
      payload: payloadFactory(currentApiConfig)
    });
  }

  async function getResult() {
    // 如果已有有效缓存且页面 URL 未变则直接复用
    if (cachedResult && cachedResult.__url === location.href && (cachedResult.cpu_name || cachedResult.Model)) {
      return cachedResult;
    }

    setStatus('解析中…');
    setBusy(true);

    // 让 background 注入对应 parser
    const resp = await chrome.runtime.sendMessage({ action: 'injectParser' });

    if (!resp.ok) {
      setStatus('✗ ' + resp.reason, 'err');
      setBusy(false);
      return null;
    }

    const parserFn = window[resp.exportName];
    if (typeof parserFn !== 'function') {
      setStatus('✗ 解析器未挂载', 'err');
      setBusy(false);
      return null;
    }

    let result;
    try {
      result = parserFn();
    } catch (e) {
      console.error('[Scraper]', e);
      setStatus('✗ 解析异常', 'err');
      setBusy(false);
      return null;
    }

    if (!result) {
      setStatus('✗ 无数据', 'err');
      setBusy(false);
      return null;
    }

    if (result.cpu_name) {
      result.__cpu_s_name = normalizeKeyword(result.cpu_name);
      result.__cpu_short_name = buildCpuShortName(result.cpu_name);
    }

    // 只有在抓取到有效信息（如 cpu_name 或 Model）时才缓存
    if (result.cpu_name || result.Model) {
      result.__url = location.href;
      cachedResult = result;
    }

    // 显示型号名 (针对 CPU parser 使用 cpu_name, 母板 parser 使用 Model)
    modelEl.textContent = result.cpu_name || result.Model || '（未识别型号）';
    setBusy(false);
    setStatus('');

    return result;
  }

  // ─── 导出 CSV ────────────────────────────────────────────────────────────────
  csvBtn.addEventListener('click', async () => {
    const result = await getResult();
    if (!result) return;

    exportCSV(result);
    setStatus('✓ CSV 已下载', 'ok');
  });

  // ─── 复制为一行（Tab 分隔，直接粘贴到 Excel / Google Sheets）──────────────
  copyBtn.addEventListener('click', async () => {
    const result = await getResult();
    if (!result) return;

    // 过滤掉内部缓存字段，值用 Tab 分隔
    const row = Object.entries(result)
      .filter(([k]) => k !== '__url')
      .map(([, v]) => (v == null ? '' : String(v).replace(/\t/g, ' ')))
      .join('\t');

    try {
      await navigator.clipboard.writeText(row);
      setStatus('✓ 已复制，可直接粘贴到表格', 'ok');
    } catch {
      // 兜底：document.execCommand（部分受限环境）
      const ta = document.createElement('textarea');
      ta.value = row;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setStatus('✓ 已复制', 'ok');
    }
  });

  checkBtn.addEventListener('click', async () => {
    const result = await getResult();
    if (!result) return;

    const entityConfig = getEntityConfig(result);
    const payload = toApiPayload(result, entityConfig);
    setStatus('查询库中…');
    setBusy(true);

    try {
      const resp = await sendAuthorizedMessage(
        entityConfig.checkAction,
        currentApiConfig => ({
          apiConfig: currentApiConfig,
          model: payload.model,
          url: payload.url,
          cpu_s_name: payload.cpu_s_name
        })
      );

      if (!resp.ok) {
        setStatus('✗ ' + humanizeError(resp.reason), 'err');
        return;
      }

      if (resp.exists) {
        setStatus(entityConfig.existsText(resp.existing), 'ok');
        return;
      }

      openModal(payload, result, entityConfig);
      setStatus('未找到，等待确认', 'err');
    } catch (error) {
      setStatus('✗ ' + humanizeError(error?.message), 'err');
    } finally {
      setBusy(false);
    }
  });

  modalMask.addEventListener('click', (event) => {
    if (event.target === modalMask) closeModal();
  });

  modalCancelBtn.addEventListener('click', () => {
    closeModal();
    setStatus('已取消写库');
  });

  modalConfirmBtn.addEventListener('click', async () => {
    if (!modalState) return;

    const payload = collectModalPayload();
    const { entityConfig } = modalState;
    if (!payload[entityConfig.keyField]) {
      showModalError(entityConfig.keyFieldLabel + '不能为空');
      return;
    }

    modalConfirmBtn.disabled = true;
    modalCancelBtn.disabled = true;
    showModalError('');

    try {
      const resp = await sendAuthorizedMessage(
        entityConfig.createAction,
        currentApiConfig => ({
          apiConfig: currentApiConfig,
          data: payload
        })
      );

      if (!resp.ok) {
        showModalError('写库失败：' + humanizeError(resp.reason));
        return;
      }

      closeModal();
      setStatus(entityConfig.createSuccessText, 'ok');
    } catch (error) {
      showModalError('写库失败：' + humanizeError(error?.message));
    } finally {
      modalConfirmBtn.disabled = false;
      modalCancelBtn.disabled = false;
    }
  });

  // ─── 工具：导出 CSV ──────────────────────────────────────────────────────────
  function exportCSV(result) {
    function escapeCSV(value) {
      if (value == null) return '';
      value = String(value);
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }

    const entries = Object.entries(result).filter(([k]) => k !== '__url');
    const headers = entries.map(([k]) => k);
    const values  = entries.map(([, v]) => escapeCSV(v));

    const csv = '\uFEFF' + headers.join(',') + '\n' + values.join(',');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = (result.Model || result.cpu_name || 'export') + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/"/g, '&quot;');
  }

  function humanizeError(reason) {
    if (reason === 'auth_cancelled') return '已取消认证输入';
    if (reason === 'auth_required') return '登录已失效，请重新输入密码';
    if (reason === 'missing_base_url') return '缺少 API 地址';
    if (reason === 'missing_username') return '缺少用户名';
    if (reason === 'missing_password') return '缺少密码';
    if (reason === 'missing_model') return '缺少主板型号';
    if (reason === 'model_too_short') return '主板型号长度不足，无法查询';
    if (reason === 'missing_cpu_name') return '缺少 CPU 名称';
    if (reason === 'cpu_name_too_short') return 'CPU 型号长度不足，无法查询';
    return reason || '未知错误';
  }

  function storageGet(area, keys) {
    return new Promise(resolve => {
      chrome.storage[area].get(keys, resolve);
    });
  }

  function storageSet(area, value) {
    return new Promise(resolve => {
      chrome.storage[area].set(value, resolve);
    });
  }

  async function loadSavedApiConfig() {
    const localData = await storageGet('local', [
      STORAGE_KEYS.baseUrl,
      STORAGE_KEYS.username
    ]);

    apiConfig = {
      baseUrl: localData[STORAGE_KEYS.baseUrl] || DEFAULT_API_BASE_URL,
      username: localData[STORAGE_KEYS.username] || '',
      password: ''
    };
  }

  async function saveApiConfig(config) {
    await storageSet('local', {
      [STORAGE_KEYS.baseUrl]: config.baseUrl,
      [STORAGE_KEYS.username]: config.username
    });
  }

  authMask.addEventListener('click', (event) => {
    if (event.target !== authMask) return;
    closeAuthModal();
    if (authResolver) {
      authResolver.reject(new Error('auth_cancelled'));
      authResolver = null;
    }
  });

  authCancelBtn.addEventListener('click', () => {
    closeAuthModal();
    if (authResolver) {
      authResolver.reject(new Error('auth_cancelled'));
      authResolver = null;
    }
  });

  authConfirmBtn.addEventListener('click', async () => {
    const nextConfig = {
      baseUrl: authBaseInput.value.trim(),
      username: authUserInput.value.trim(),
      password: authPassInput.value
    };

    if (!nextConfig.baseUrl) {
      showAuthError('请输入 API 地址');
      return;
    }
    if (!nextConfig.username) {
      showAuthError('请输入用户名');
      return;
    }
    if (!nextConfig.password) {
      showAuthError('请输入密码');
      return;
    }

    apiConfig = nextConfig;
    await saveApiConfig(nextConfig);
    closeAuthModal();
    if (authResolver) {
      authResolver.resolve(getApiConfig());
      authResolver = null;
    }
  });

  authPassInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authConfirmBtn.click();
  });

})();
