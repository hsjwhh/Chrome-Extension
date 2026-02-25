(function () {
  // 防止重复注入（SPA 页面跳转时 content_scripts 不会重新执行，但保险起见保留）
  if (document.getElementById('__scraper_bar__')) return;

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
    #__scraper_bar__ .scraper-status {
      font-size: 12px;
      color: #64748b;
      margin-left: 4px;
    }
    #__scraper_bar__ .scraper-status.ok  { color: #34d399; }
    #__scraper_bar__ .scraper-status.err { color: #f87171; }
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
    <span  class="scraper-status"        id="__scraper_status__"></span>
  `;

  // 插到 body 最前面（保证 sticky 生效）
  document.body.insertBefore(bar, document.body.firstChild);

  const modelEl  = document.getElementById('__scraper_model__');
  const csvBtn   = document.getElementById('__scraper_csv__');
  const copyBtn  = document.getElementById('__scraper_copy__');
  const statusEl = document.getElementById('__scraper_status__');

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

  async function getResult() {
    // 如果已有缓存且页面 URL 未变则直接复用
    if (cachedResult && cachedResult.__url === location.href) {
      return cachedResult;
    }

    setStatus('解析中…');
    csvBtn.disabled = copyBtn.disabled = true;

    // 让 background 注入对应 parser
    const resp = await chrome.runtime.sendMessage({ action: 'injectParser' });

    if (!resp.ok) {
      setStatus('✗ ' + resp.reason, 'err');
      csvBtn.disabled = copyBtn.disabled = false;
      return null;
    }

    const parserFn = window[resp.exportName];
    if (typeof parserFn !== 'function') {
      setStatus('✗ 解析器未挂载', 'err');
      csvBtn.disabled = copyBtn.disabled = false;
      return null;
    }

    let result;
    try {
      result = parserFn();
    } catch (e) {
      console.error('[Scraper]', e);
      setStatus('✗ 解析异常', 'err');
      csvBtn.disabled = copyBtn.disabled = false;
      return null;
    }

    if (!result) {
      setStatus('✗ 无数据', 'err');
      csvBtn.disabled = copyBtn.disabled = false;
      return null;
    }

    result.__url = location.href; // 用于缓存判断
    cachedResult = result;

    // 显示型号名
    modelEl.textContent = result.Model || '（未识别型号）';
    csvBtn.disabled = copyBtn.disabled = false;
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
    link.download = (result.Model || 'export') + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

})();
