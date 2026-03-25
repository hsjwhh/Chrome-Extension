(function () {
  // 防止重复注入
  if (document.getElementById('__scraper_bar__')) return;

  // ─── 配置与常量 ──────────────────────────────────────────────────────────────
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
    { apiKey: 'cpu_s_name', label: '标准化型号', sourceKey: 'cpu_s_name' },
    { apiKey: 'cpu_short_name', label: 'CPU简称', sourceKey: 'cpu_short_name' },
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
    { apiKey: 'scalability', label: '可扩展性', sourceKey: 'scalability' },
    { apiKey: 'gpu', label: '集显型号', sourceKey: 'gpu' },
    { apiKey: 'sku', label: 'SKU', sourceKey: 'sku' }
  ];
  const DEFAULT_API_BASE_URL = 'http://localhost:3000';
  const STORAGE_KEYS = {
    baseUrl: 'mbScraper.apiBaseUrl',
    username: 'mbScraper.apiUsername'
  };

  // ─── 样式注入 ────────────────────────────────────────────────────────────────
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
    #__scraper_bar__ .btn-csv { background: #4b6ef6; color: #fff; }
    #__scraper_bar__ .btn-copy { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
    #__scraper_bar__ .btn-check { background: #0f766e; color: #ecfeff; border: 1px solid #115e59; }
    #__scraper_bar__ .btn-batch { background: #7c3aed; color: #fff; border: 1px solid #6d28d9; }
    
    #__scraper_bar__ .scraper-status {
      font-size: 12px;
      color: #64748b;
      margin-left: 4px;
    }
    #__scraper_bar__ .scraper-status.ok  { color: #34d399; }
    #__scraper_bar__ .scraper-status.err { color: #f87171; }

    /* 通用 Modal 样式 */
    .scraper-modal-mask {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); z-index: 2147483647;
      display: none; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box;
    }
    .scraper-modal {
      background: #fff; color: #0f172a; border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
      font-family: system-ui, sans-serif;
      display: flex; flex-direction: column;
      max-height: 85vh; width: 600px;
    }
    .scraper-modal.large { width: 900px; }
    
    .scraper-modal-head {
      padding: 16px 24px; border-bottom: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .scraper-modal-title { font-size: 16px; font-weight: 700; margin: 0; }
    .scraper-modal-close { cursor: pointer; color: #94a3b8; font-size: 20px; line-height: 1; }
    
    .scraper-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
    
    .scraper-modal-foot {
      padding: 16px 24px; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: flex-end; gap: 10px; background: #f8fafc; border-radius: 0 0 12px 12px;
    }

    /* 批量抓取专用样式 */
    .batch-list { display: flex; flex-direction: column; gap: 4px; }
    .batch-item {
      display: flex; align-items: center; gap: 10px; padding: 8px;
      border-bottom: 1px solid #f1f5f9; font-size: 13px;
    }
    .batch-item:last-child { border-bottom: none; }
    .batch-item.success { color: #059669; }
    .batch-item.error { color: #dc2626; }
    .batch-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .batch-item-status { font-size: 12px; color: #64748b; width: 80px; text-align: right; }
    
    .batch-toolbar { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; }
    .batch-progress { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
    .batch-progress-bar { height: 100%; background: #7c3aed; width: 0%; transition: width 0.3s; }
    
    /* 认证/详情 Modal 复用样式 */
    .map-row { display: grid; grid-template-columns: 140px 1fr 1.2fr; gap: 12px; margin-bottom: 12px; align-items: start; }
    .map-label { font-size: 13px; font-weight: 600; color: #334155; padding-top: 8px; }
    .map-source { background: #f1f5f9; padding: 8px; border-radius: 6px; font-size: 12px; word-break: break-all; color: #475569; }
    .map-input { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; box-sizing: border-box; }
    .map-textarea { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; min-height: 60px; box-sizing: border-box; resize: vertical; }
    
    .modal-btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; }
    .modal-btn.primary { background: #0f766e; color: #fff; }
    .modal-btn.secondary { background: #e2e8f0; color: #0f172a; }
    .modal-btn.danger { background: #fee2e2; color: #991b1b; }
  `;
  document.head.appendChild(style);

  // ─── DOM 结构初始化 ──────────────────────────────────────────────────────────
  const bar = document.createElement('div');
  bar.id = '__scraper_bar__';
  // 默认显示“初始化中...”
  bar.innerHTML = `
    <span class="scraper-label">⬡ Scraper</span>
    <span class="scraper-model" id="__scraper_model__">Initializing...</span>
    
    <!-- 单品模式按钮 -->
    <div id="__scraper_single_actions__" style="display:none; gap:10px; align-items:center;">
      <button class="scraper-btn btn-csv"  id="__scraper_csv__">↓ CSV</button>
      <button class="scraper-btn btn-copy" id="__scraper_copy__">⎘ Copy</button>
      <button class="scraper-btn btn-check" id="__scraper_check__">⇄ Check DB</button>
    </div>

    <!-- 批量模式按钮 -->
    <div id="__scraper_batch_actions__" style="display:none; gap:10px; align-items:center;">
      <button class="scraper-btn btn-batch" id="__scraper_batch_open__">≡ Batch Scrape (<span id="__scraper_batch_count__">0</span>)</button>
    </div>

    <span class="scraper-status" id="__scraper_status__"></span>
  `;
  document.body.insertBefore(bar, document.body.firstChild);

  // ─── 状态与引用 ──────────────────────────────────────────────────────────────
  const ui = {
    model: document.getElementById('__scraper_model__'),
    singleActions: document.getElementById('__scraper_single_actions__'),
    batchActions: document.getElementById('__scraper_batch_actions__'),
    batchCount: document.getElementById('__scraper_batch_count__'),
    status: document.getElementById('__scraper_status__'),
    
    // Buttons
    btnCsv: document.getElementById('__scraper_csv__'),
    btnCopy: document.getElementById('__scraper_copy__'),
    btnCheck: document.getElementById('__scraper_check__'),
    btnBatchOpen: document.getElementById('__scraper_batch_open__')
  };

  let runtime = {
    mode: 'unknown', // 'single' | 'batch' | 'error'
    parserExportName: null,
    finderName: null,
    batchLinks: [],
    cachedResult: null
  };

  // ─── 核心初始化逻辑 ──────────────────────────────────────────────────────────
  (async function init() {
    ui.status.textContent = 'Injecting parser...';
    
    // 1. 请求 Background 注入解析器
    const resp = await chrome.runtime.sendMessage({ action: 'injectParser' });
    if (!resp || !resp.ok) {
      ui.status.textContent = '✗ ' + (resp?.reason || 'Injection failed');
      ui.status.className = 'scraper-status err';
      return;
    }

    runtime.parserExportName = resp.exportName;
    // 约定：findLinks 函数名为 find{Brand}Links，例如 parseAsus -> findAsusLinks
    runtime.finderName = resp.exportName.replace(/^parse/, 'find') + 'Links';

    // 2. 检测页面类型 (List vs Detail)
    const finderFn = window[runtime.finderName];
    if (typeof finderFn === 'function') {
      try {
        const links = finderFn(document);
        if (links && links.length > 1) { // 阈值 > 1 判定为列表页
          runtime.mode = 'batch';
          runtime.batchLinks = links;
          setupBatchMode();
          return;
        }
      } catch (e) {
        console.warn('[Scraper] List detection failed:', e);
      }
    }

    // 3. 默认为单品模式
    runtime.mode = 'single';
    setupSingleMode();
  })();

  // ─── 单品模式逻辑 ────────────────────────────────────────────────────────────
  function setupSingleMode() {
    ui.singleActions.style.display = 'flex';
    ui.batchActions.style.display = 'none';
    ui.status.textContent = '';
    
    // 尝试预抓取一次以显示型号
    getResult().then(res => {
      if (res) ui.model.textContent = res.cpu_name || res.Model || 'Ready';
    });

    ui.btnCsv.onclick = async () => {
      const res = await getResult();
      if (res) {
        exportCSV([res], (res.Model || res.cpu_name || 'export'));
        setStatus('✓ CSV Downloaded', 'ok');
      }
    };

    ui.btnCopy.onclick = async () => {
      const res = await getResult();
      if (!res) return;
      const row = Object.entries(res)
        .filter(([k]) => k !== '__url')
        .map(([, v]) => (v == null ? '' : String(v).replace(/\t/g, ' ')))
        .join('\t');
      await navigator.clipboard.writeText(row);
      setStatus('✓ Copied to clipboard', 'ok');
    };

    ui.btnCheck.onclick = () => checkDbFlow();
  }

  // ─── 批量模式逻辑 ────────────────────────────────────────────────────────────
  let batchModal = null; // 缓存 DOM
  
  function setupBatchMode() {
    ui.singleActions.style.display = 'none';
    ui.batchActions.style.display = 'flex';
    ui.batchCount.textContent = runtime.batchLinks.length;
    ui.model.textContent = 'Batch Mode';
    ui.status.textContent = '';

    ui.btnBatchOpen.onclick = openBatchModal;
  }

  function openBatchModal() {
    if (document.getElementById('__scraper_batch_mask__')) {
      document.getElementById('__scraper_batch_mask__').style.display = 'flex';
      return;
    }

    // 创建批量 Modal
    const mask = document.createElement('div');
    mask.id = '__scraper_batch_mask__';
    mask.className = 'scraper-modal-mask';
    mask.innerHTML = `
      <div class="scraper-modal large">
        <div class="scraper-modal-head">
          <h3 class="scraper-modal-title">Batch Scraper</h3>
          <span class="scraper-modal-close" id="__batch_close__">×</span>
        </div>
        <div class="scraper-modal-body">
          <div class="batch-toolbar">
            <button class="modal-btn secondary" id="__batch_select_all__">Select All</button>
            <button class="modal-btn secondary" id="__batch_select_none__">Select None</button>
            <div style="flex:1"></div>
            <span id="__batch_status_text__" style="font-size:12px;color:#64748b">Ready</span>
          </div>
          <div class="batch-progress"><div class="batch-progress-bar" id="__batch_progress_bar__"></div></div>
          <div class="batch-list" id="__batch_list__"></div>
        </div>
        <div class="scraper-modal-foot">
          <button class="modal-btn secondary" id="__batch_export__" disabled>Export CSV</button>
          <button class="modal-btn primary" id="__batch_start__">Start Scraping</button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);
    
    // 渲染列表
    const listEl = mask.querySelector('#__batch_list__');
    runtime.batchLinks.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'batch-item';
      row.innerHTML = `
        <input type="checkbox" class="batch-chk" data-idx="${idx}" checked>
        <span class="batch-item-name" title="${item.url}">${item.name}</span>
        <span class="batch-item-status" id="__batch_status_${idx}__">Waiting</span>
      `;
      listEl.appendChild(row);
    });

    // 绑定事件
    mask.querySelector('#__batch_close__').onclick = () => mask.style.display = 'none';
    mask.querySelector('#__batch_select_all__').onclick = () => toggleChecks(true);
    mask.querySelector('#__batch_select_none__').onclick = () => toggleChecks(false);
    
    const startBtn = mask.querySelector('#__batch_start__');
    const exportBtn = mask.querySelector('#__batch_export__');
    
    let isRunning = false;
    let results = [];

    // 监听 Background 的进度消息
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'batchProgress') {
        const { index, total, statusText, statusType, data, error } = msg;
        
        // 更新单行状态
        const statusEl = document.getElementById(`__batch_status_${index}__`);
        if (statusEl) {
          statusEl.textContent = statusText;
          statusEl.className = 'batch-item-status ' + (statusType === 'error' ? 'error' : (statusType === 'success' ? 'success' : ''));
          if (error) statusEl.title = error;
        }

        // 保存结果
        if (data) {
          results[index] = data;
        }
        
        // 更新总进度条
        // 注意：BatchScraper 的逻辑是处理完一项后通知 Done，然后立刻准备下一项。
        // 这里简单用 (index + (statusType === 'active' ? 0 : 1)) / total 估算
        // 为了 UI 平滑，Done 时进度 +1
        if (statusType === 'success' || statusType === 'error') {
           updateProgress(index + 1, total);
        }
      }

      if (msg.action === 'batchComplete') {
        isRunning = false;
        startBtn.textContent = 'Finished';
        exportBtn.disabled = false;
        results = msg.results.filter(r => r); // 过滤掉失败的 null
      }
      
      if (msg.action === 'batchAborted') {
        isRunning = false;
        startBtn.textContent = 'Aborted';
        startBtn.disabled = false;
        alert('Scraping aborted: ' + msg.reason);
      }
    });

    startBtn.onclick = async () => {
      if (isRunning) return;
      
      // 获取勾选项
      const checkboxes = Array.from(document.querySelectorAll('.batch-chk:checked'));
      if (checkboxes.length === 0) return;

      isRunning = true;
      startBtn.disabled = true;
      startBtn.textContent = 'Starting...';
      results = [];
      
      // 构建任务列表 (只包含被选中的)
      // 注意：Background 是按索引顺序执行的。为了方便 UI 映射，我们传输完整的 links 数组吗？
      // 或者传输选中的子集？
      // 为了 UI 对应简单，我们传输选中的子集，但在 UI 上我们通过 data-idx 映射回原始列表。
      // 但 Background 回传的 index 是它 queue 的 index。
      // 方案：重建一个 queue，并将 UI 上的行 ID 传给 background，background 原样回传。
      // 但为了少改 background，我们简单点：
      // 只传选中的链接，Background 回传 0, 1, 2... 我们在 UI 上找到对应的第 0, 1, 2 个被选中的 checkbox 更新状态。
      
      const selectedLinks = checkboxes.map(chk => {
        const idx = parseInt(chk.dataset.idx);
        return runtime.batchLinks[idx];
      });

      // 重置 UI 状态
      checkboxes.forEach(chk => {
         const idx = chk.dataset.idx;
         const el = document.getElementById(`__batch_status_${idx}__`);
         el.textContent = 'Waiting';
         el.className = 'batch-item-status';
      });

      // 发送任务
      const resp = await chrome.runtime.sendMessage({
        action: 'startBatchScrape',
        links: selectedLinks
      });

      if (!resp.ok) {
        alert('Failed to start: ' + resp.reason);
        isRunning = false;
        startBtn.disabled = false;
        startBtn.textContent = 'Start Scraping';
      }
    };
    
    // 由于 Background 回传的是 queue index (0, 1, 2...)
    // 我们需要将其映射回 UI 上的真实 DOM 元素
    // 复写上面的 onMessage 处理逻辑来支持这种映射
    const _originalListener = chrome.runtime.onMessage.addListener;
    // 重新定义监听器 (为了闭包能访问 checkboxes 变量，我们需要把监听器放在 click 内部吗？)
    // 不行，onMessage 是全局的。
    // 解决：我们在 start 时记录一个 "activeTaskMap": queueIndex -> uiIndex
    
    let activeTaskMap = []; // [uiIndex1, uiIndex2, ...]

    // 重新绑定正确的 click 处理
    startBtn.onclick = async () => {
      if (isRunning) return;
      const checkboxes = Array.from(document.querySelectorAll('.batch-chk:checked'));
      if (checkboxes.length === 0) return;
      
      // 记录映射关系
      activeTaskMap = checkboxes.map(c => parseInt(c.dataset.idx));
      
      isRunning = true;
      startBtn.disabled = true;
      startBtn.textContent = 'Running...';
      results = [];
      
      // 重置状态
      activeTaskMap.forEach(uiIdx => {
         const el = document.getElementById(`__batch_status_${uiIdx}__`);
         if (el) {
             el.textContent = 'Queued';
             el.className = 'batch-item-status';
         }
      });

      const queue = activeTaskMap.map(i => runtime.batchLinks[i]);
      
      // 获取 API Config (如果已登录)
      // const config = await ensureApiConfig().catch(() => null);
      // if (!config) ...

      const resp = await chrome.runtime.sendMessage({
        action: 'startBatchScrape',
        links: queue
      });
      
      if (!resp.ok) {
        alert('Start failed: ' + resp.reason);
        isRunning = false;
        startBtn.disabled = false;
        startBtn.textContent = 'Start Scraping';
      }
    };
    
    // 全局监听器 (只绑定一次)
    if (!window._batchMsgListenerBound) {
        window._batchMsgListenerBound = true;
        chrome.runtime.onMessage.addListener((msg) => {
            if (!isRunning) return; // 如果 UI 认为没在跑，忽略（或者是上一次任务的残留）

            if (msg.action === 'batchProgress') {
                const uiIdx = activeTaskMap[msg.index];
                if (uiIdx === undefined) return;

                const statusEl = document.getElementById(`__batch_status_${uiIdx}__`);
                if (statusEl) {
                    statusEl.textContent = msg.statusText;
                    statusEl.className = 'batch-item-status ' + (msg.statusType === 'error' ? 'error' : (msg.statusType === 'success' ? 'success' : ''));
                    if (msg.statusText === 'Fetching...') statusEl.style.color = '#3b82f6';
                }
                
                if (msg.data) results[msg.index] = msg.data;
                
                if (msg.statusType === 'success' || msg.statusType === 'error') {
                   updateProgress(msg.index + 1, activeTaskMap.length);
                }
            }
            
            if (msg.action === 'batchComplete') {
                isRunning = false;
                startBtn.textContent = 'Finished';
                exportBtn.disabled = false;
                // 合并结果
                if (msg.results) {
                    results = msg.results.filter(r => r);
                }
            }
            
            if (msg.action === 'batchAborted') {
                isRunning = false;
                startBtn.textContent = 'Aborted';
                startBtn.disabled = false;
                alert('Aborted: ' + msg.reason);
            }
        });
    }

    // 绑定导出
    exportBtn.onclick = () => {
      exportCSV(results, `batch_export_${Date.now()}`);
    };

    mask.style.display = 'flex';
  }

  function toggleChecks(checked) {
    document.querySelectorAll('.batch-chk').forEach(c => c.checked = checked);
  }

  function updateProgress(current, total) {
    const pct = Math.round((current / total) * 100);
    document.getElementById('__batch_progress_bar__').style.width = pct + '%';
    document.getElementById('__batch_status_text__').textContent = `${current}/${total}`;
  }


  // ─── 通用工具函数 ────────────────────────────────────────────────────────────
  
  async function getResult() {
    if (runtime.cachedResult && runtime.cachedResult.__url === location.href) return runtime.cachedResult;

    setStatus('Parsing...');
    const parserFn = window[runtime.parserExportName];
    if (!parserFn) return null;

    try {
      const result = parserFn(document);
      if (result && (result.Model || result.cpu_name)) {
        result.__url = location.href;
        runtime.cachedResult = result;
        setStatus('');
        return result;
      }
    } catch (e) {
      console.error(e);
      setStatus('Parse Error', 'err');
    }
    return null;
  }

  function setStatus(msg, type = '') {
    ui.status.textContent = msg;
    ui.status.className = 'scraper-status' + (type ? ' ' + type : '');
    // 3s 后清除
    setTimeout(() => {
        if (ui.status.textContent === msg) ui.status.textContent = '';
    }, 3000);
  }

  function exportCSV(results, filename) {
    if (!results || !results.length) return;
    
    // 取所有 keys 的并集
    const allKeys = new Set();
    results.forEach(r => Object.keys(r).forEach(k => {
        if (k !== '__url') allKeys.add(k);
    }));
    const headers = Array.from(allKeys);
    
    const csvContent = [
      '\uFEFF' + headers.join(','), // Header
      ...results.map(row => {
        return headers.map(k => {
          let val = row[k];
          if (val == null) return '';
          val = String(val);
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = (filename || 'export') + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ─── DB Check / Auth 流程 (复用原有逻辑，略微简化) ───────────────────────────
  // 这里保留原有的 checkDbFlow, openModal 等逻辑，仅做结构适配
  // 为节省篇幅，这里假设原有 check/create/auth 逻辑已封装或直接保留在闭包中
  // 由于我重写了整个文件，必须把之前的 DB 交互逻辑搬过来
  
  let authResolver = null;
  let apiConfig = { baseUrl: DEFAULT_API_BASE_URL, username: '' };
  
  // 加载配置
  chrome.storage.local.get([STORAGE_KEYS.baseUrl, STORAGE_KEYS.username], (items) => {
    apiConfig.baseUrl = items[STORAGE_KEYS.baseUrl] || DEFAULT_API_BASE_URL;
    apiConfig.username = items[STORAGE_KEYS.username] || '';
  });

  async function checkDbFlow() {
    const result = await getResult();
    if (!result) return;

    setStatus('Checking DB...');
    const entityConfig = getEntityConfig(result);
    const payload = toApiPayload(result, entityConfig);

    try {
      const resp = await sendAuthorizedMessage(
        entityConfig.checkAction,
        cfg => ({ apiConfig: cfg, [entityConfig.keyField]: payload[entityConfig.keyField], url: payload.url })
      );

      if (resp.ok) {
        if (resp.exists) {
            setStatus(`✓ Exists: ${resp.existing?.model || resp.existing?.cpu_s_name}`, 'ok');
        } else {
            openCheckModal(payload, result, entityConfig);
            setStatus('Not found', 'err');
        }
      } else {
        setStatus('✗ ' + resp.reason, 'err');
      }
    } catch (e) {
      setStatus('✗ ' + e.message, 'err');
    }
  }

  // 辅助函数：生成 API Payload
  function getEntityConfig(result) {
    if (result.cpu_name) {
      return {
        type: 'cpu', checkAction: 'checkCpu', createAction: 'createCpu',
        keyField: 'cpu_s_name', label: 'CPU',
        fieldConfig: CPU_FIELD_CONFIG
      };
    }
    return {
      type: 'mb', checkAction: 'checkMotherboard', createAction: 'createMotherboard',
      keyField: 'model', label: 'Motherboard',
      fieldConfig: FIELD_CONFIG
    };
  }

  function toApiPayload(result, entityConfig) {
    const payload = {};
    entityConfig.fieldConfig.forEach(f => payload[f.apiKey] = result[f.sourceKey] || '');
    return payload;
  }

  // ─── 认证通信 ──────────────────────────────────────────────────────────────
  async function sendAuthorizedMessage(action, payloadFactory) {
    let cfg = await ensureApiConfig();
    let resp = await chrome.runtime.sendMessage({ action, payload: payloadFactory(cfg) });
    
    if (resp && resp.reason === 'auth_required') {
       // 重新输入密码
       cfg = await ensureApiConfig(true);
       resp = await chrome.runtime.sendMessage({ action, payload: payloadFactory(cfg) });
    }
    return resp;
  }

  function ensureApiConfig(force = false) {
    if (!force && apiConfig.baseUrl && apiConfig.username) return Promise.resolve(apiConfig);
    return new Promise((resolve, reject) => {
        authResolver = { resolve, reject };
        openAuthModal();
    });
  }

  // ─── UI: Auth Modal ────────────────────────────────────────────────────────
  function openAuthModal() {
    if (document.getElementById('__auth_mask__')) {
        document.getElementById('__auth_mask__').style.display = 'flex';
        return;
    }
    const mask = document.createElement('div');
    mask.id = '__auth_mask__';
    mask.className = 'scraper-modal-mask';
    mask.innerHTML = `
      <div class="scraper-modal">
        <div class="scraper-modal-head"><h3 class="scraper-modal-title">API Auth</h3></div>
        <div class="scraper-modal-body">
            <div style="margin-bottom:10px">
                <label style="display:block;font-size:12px;font-weight:600">API URL</label>
                <input class="map-input" id="__auth_base__" value="${apiConfig.baseUrl}">
            </div>
            <div style="margin-bottom:10px">
                <label style="display:block;font-size:12px;font-weight:600">Username</label>
                <input class="map-input" id="__auth_user__" value="${apiConfig.username}">
            </div>
            <div style="margin-bottom:10px">
                <label style="display:block;font-size:12px;font-weight:600">Password</label>
                <input class="map-input" type="password" id="__auth_pass__">
            </div>
            <div id="__auth_err__" style="color:red;font-size:12px"></div>
        </div>
        <div class="scraper-modal-foot">
            <button class="modal-btn secondary" id="__auth_cancel__">Cancel</button>
            <button class="modal-btn primary" id="__auth_ok__">Login</button>
        </div>
      </div>
    `;
    document.body.appendChild(mask);
    
    const okBtn = mask.querySelector('#__auth_ok__');
    const cancelBtn = mask.querySelector('#__auth_cancel__');
    const passInput = mask.querySelector('#__auth_pass__');
    
    function submit() {
        const base = mask.querySelector('#__auth_base__').value.trim();
        const user = mask.querySelector('#__auth_user__').value.trim();
        const pass = passInput.value;
        if (!base || !user || !pass) {
            mask.querySelector('#__auth_err__').textContent = 'All fields required';
            return;
        }
        
        apiConfig = { baseUrl: base, username: user, password: pass };
        chrome.storage.local.set({ [STORAGE_KEYS.baseUrl]: base, [STORAGE_KEYS.username]: user });
        
        mask.style.display = 'none';
        if (authResolver) { authResolver.resolve(apiConfig); authResolver = null; }
    }

    okBtn.onclick = submit;
    passInput.onkeydown = e => { if (e.key === 'Enter') submit(); };
    
    cancelBtn.onclick = () => {
        mask.style.display = 'none';
        if (authResolver) { authResolver.reject(new Error('Cancelled')); authResolver = null; }
    };
  }

  // ─── UI: Check/Create Modal ────────────────────────────────────────────────
  function openCheckModal(payload, result, entityConfig) {
    let mask = document.getElementById('__check_mask__');
    if (!mask) {
        mask = document.createElement('div');
        mask.id = '__check_mask__';
        mask.className = 'scraper-modal-mask';
        mask.innerHTML = `
          <div class="scraper-modal large">
            <div class="scraper-modal-head">
                <h3 class="scraper-modal-title">Review Data</h3>
                <span class="scraper-modal-close" onclick="this.closest('.scraper-modal-mask').style.display='none'">×</span>
            </div>
            <div class="scraper-modal-body" id="__check_body__"></div>
            <div class="scraper-modal-foot">
                <button class="modal-btn secondary" onclick="this.closest('.scraper-modal-mask').style.display='none'">Cancel</button>
                <button class="modal-btn primary" id="__check_submit__">Submit</button>
            </div>
          </div>
        `;
        document.body.appendChild(mask);
    }
    
    const body = mask.querySelector('#__check_body__');
    body.innerHTML = entityConfig.fieldConfig.map(f => `
        <div class="map-row">
            <div class="map-label">${f.label}<br><span style="color:#94a3b8;font-size:11px">${f.apiKey}</span></div>
            <div class="map-source">${result[f.sourceKey] || '-'}</div>
            <div>
                ${f.multiline 
                  ? `<textarea class="map-textarea" data-key="${f.apiKey}">${payload[f.apiKey]||''}</textarea>`
                  : `<input class="map-input" data-key="${f.apiKey}" value="${payload[f.apiKey]||''}">`
                }
            </div>
        </div>
    `).join('');

    mask.querySelector('#__check_submit__').onclick = async function() {
        const btn = this;
        btn.disabled = true;
        btn.textContent = 'Submitting...';
        
        const newPayload = {};
        body.querySelectorAll('[data-key]').forEach(el => newPayload[el.dataset.key] = el.value.trim());
        
        try {
            const resp = await sendAuthorizedMessage(entityConfig.createAction, cfg => ({
                apiConfig: cfg, data: newPayload
            }));
            if (resp.ok) {
                mask.style.display = 'none';
                setStatus('✓ Saved to DB', 'ok');
            } else {
                alert('Error: ' + resp.reason);
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Submit';
        }
    };
    
    mask.style.display = 'flex';
  }

})();