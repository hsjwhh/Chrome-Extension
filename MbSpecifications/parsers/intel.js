window.parseIntel = function parseIntel() {

  // ─── 工具函数 ────────────────────────────────────────────────────────────
  function clean(value) {
    return String(value || '')
      .replace(/[®™†‡*]/g, '')
      // 品牌词/系列词中英互换与基础清理
      .replace(/英特尔/g, 'Intel')
      .replace(/至强/g, 'Xeon')
      .replace(/酷睿/g, 'Core')
      // 移除冗余词汇 (全局移除，处理如 "i9 处理器 14900" 的情况)
      .replace(/\s*(?:Processor|处理器)\s*/gi, ' ')
      // 移除尾部的规格描述 (如 36M Cache, up to 5.80 GHz 等)，兼容有无括号
      .replace(/\s*(?:[\(（]|\b)(?:\d+M\s+)?(?:cache|高速缓存|up to|高达|睿频频率|ghz).*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractIntelProductName() {
    const candidates = [];

    function push(value) {
      const cleaned = clean(value);
      if (cleaned) candidates.push(cleaned);
    }

    push(document.querySelector('h1')?.innerText);
    push(document.querySelector('.product-family-title-text')?.innerText);
    push(document.querySelector('.ark-product-name')?.innerText);

    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach(script => {
        try {
          const parsed = JSON.parse(script.textContent || 'null');
          const items = Array.isArray(parsed) ? parsed : [parsed];
          items.forEach(item => {
            if (item && typeof item === 'object') {
              push(item.name);
              push(item.headline);
            }
          });
        } catch (_) {}
      });

    push(document.querySelector('meta[property="og:title"]')?.content);
    push(document.querySelector('meta[name="title"]')?.content);
    push(document.title);

    const breadcrumbText = Array.from(
      document.querySelectorAll('nav, [aria-label*="breadcrumb" i], .breadcrumb')
    )
      .map(node => node.innerText)
      .find(text => text && /intel/i.test(text) && /processor/i.test(text));
    if (breadcrumbText) {
      const breadcrumbParts = breadcrumbText
        .split(/\n|>/)
        .map(part => clean(part))
        .filter(Boolean);
      push(breadcrumbParts[breadcrumbParts.length - 1]);
    }

    const preferred = candidates.find(value =>
      /intel/i.test(value) &&
      /processor|处理器/i.test(value) &&
      !/[()]/.test(value)
    );
    return preferred || candidates[0] || '';
  }

  function pickSpec(specMap, keys) {
    for (const key of keys) {
      const value = specMap[key];
      if (value) return value;
    }
    return '';
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function extractValueFromPageText(labels) {
    const text = document.body.innerText;
    for (const label of labels) {
      const regex = new RegExp(escapeRegExp(label) + '\\s*\\n+\\s*([^\\n]{1,100})', 'i');
      const match = text.match(regex);
      if (match) return clean(match[1]);
    }
    return '';
  }

  // 构建 label → value 映射
  function buildSpecMap() {
    const map = {};
    const text = document.body.innerText;

    // 1. 获取所有可能是 label 和 value 的元素
    const allLabels = document.querySelectorAll('.spec-label, .label, [class*="label"]');
    const allValues = document.querySelectorAll('.spec-data, .value, [class*="value"]');

    // 2. 尝试从共同父元素 (如 li 或 div) 提取
    document.querySelectorAll('li, tr, .row, [class*="item"]').forEach(container => {
      const label = container.querySelector('.spec-label, .label, [class*="label"]')?.innerText;
      const value = container.querySelector('.spec-data, .value, [class*="value"]')?.innerText;
      if (label && value) {
        const cleanedLabel = clean(label);
        if (cleanedLabel && cleanedLabel.length < 50) { // 避免抓到整段文字
          map[cleanedLabel] = clean(value);
        }
      }
    });

    // 3. 如果还是空，尝试全局扫描所有 spec-label 并找其后续元素 (针对某些 grid 布局)
    if (Object.keys(map).length === 0) {
      document.querySelectorAll('.spec-label').forEach(labelEl => {
        const label = clean(labelEl.innerText);
        if (!label) return;
        let next = labelEl.nextElementSibling;
        while (next && next.tagName !== 'DIV' && next.tagName !== 'SPAN') {
           next = next.nextElementSibling;
        }
        if (next && (next.classList.contains('spec-data') || next.innerText.length > 0)) {
           map[label] = clean(next.innerText);
        }
      });
    }

    // 4. 文本兜底：补齐 DOM 扫描漏掉的字段，支持中英文双语
    const keywordGroups = [
      ['发行日期', 'Launch Date'],
      ['处理器编号', 'Processor Number'],
      ['内核数', 'Total Cores'],
      ['最大睿频频率', 'Max Turbo Frequency'],
      ['缓存', 'Cache'],
      ['处理器基础功耗', 'Processor Base Power'],
      ['最大睿频功耗', 'Maximum Turbo Power'],
      ['最大内存大小（取决于内存类型）', 'Max Memory Size (dependent on memory type)'],
      ['最大内存通道数', 'Max # of Memory Channels'],
      ['内存类型', 'Memory Types'],
      ['支持的 ECC 内存', 'ECC Memory Supported'],
      ['支持的插槽', 'Sockets Supported'],
      ['PCI Express 修订版', 'PCI Express Revision'],
      ['PCI Express 通道数的最大值', 'Max # of PCI Express Lanes'],
      ['可扩展性', 'Scalability'],
      ['Performance-core（性能核）基本频率', 'Performance-core Base Frequency', '处理器基本频率', 'Processor Base Frequency'],
      ['处理器显卡', '显卡名称', '嵌入式显卡', 'GPU Name', 'Processor Graphics', 'Graphics Model'],
      ['SKU']
    ];
    keywordGroups.forEach(group => {
      if (group.some(k => map[k])) return;
      for (const kw of group) {
        // 改进正则：允许关键词后面跟随特殊符号（如 ‡, *, 注册商标等）再接换行/空格
        const regex = new RegExp(escapeRegExp(kw) + '[^\\n\\w\\u4e00-\\u9fa5]*[\\s\\n]+([^\\n]{1,100})', 'i');
        const match = text.match(regex);
        if (match) {
          map[group[0]] = clean(match[1]);
          break;
        }
      }
    });

    return map;
  }

  const result = {
    URL:                location.href,
    cpu_name:           '',
    cpu_short_name:     '',
    cpu_s_name:         '',
    release_date:       '',
    cores:              '',
    max_turbo:          '',
    base_freq:          '',
    cache:              '',
    tdp:                '',
    memory_channels:    '',
    memory_speed:       '',
    max_memory_speed:   '',
    max_memory_capacity:'',
    ecc_support:        '',
    socket:             '',
    pci:                '',
    scalability:        '',
    gpu:                '',
    sku:                ''
  };

  const specMap = buildSpecMap();

  // ─── 处理器名称深度处理 (极致精简逻辑) ──────────────────────────────────
  
  let rawName = extractIntelProductName();
  
  // 1. cpu_name: 基础标准化 (Intel Xeon 6430 / Intel i9-14900 / Intel Ultra 9 285K)
  let cn = rawName;
  // 移除至强分级词
  cn = cn.replace(/(Intel\s+Xeon)\s+(?:Platinum|Gold|Silver|Bronze)\s+/i, '$1 ');
  
  if (/Intel\s+Core\s+(i[3579])(?:[- ]?)\s*(.*)/i.test(cn)) {
    // 强制 Core i 系列带横杠: Intel i9-14900
    cn = cn.replace(/Intel\s+Core\s+(i[3579])(?:[- ]?)\s*(.*)/i, 'Intel $1-$2');
  } else if (/Intel\s+Core\s+Ultra\s+([3579])\s+(.*)/i.test(cn)) {
    // Core Ultra 系列: Intel Ultra 9 285K
    cn = cn.replace(/Intel\s+Core\s+Ultra\s+([3579])\s+(.*)/i, 'Intel Ultra $1 $2');
  } else {
    // 其他情况移除 Core 中间词
    cn = cn.replace(/Intel\s+Core\s+/i, 'Intel ');
  }
  result.cpu_name = cn;

  // 2. cpu_short_name: 核心展示名 (Intel 6430 / Intel i9-14900 / Intel Ultra 9 285K)
  // 对于至强系列，进一步移除 "Xeon" 以达到极致精简 (Intel 6430)
  // 对于酷睿系列，保留级别词 iX / Ultra X 以增强辨识度 (Intel i9-14900)
  let sn = cn;
  if (/Intel\s+Xeon\s+/i.test(cn)) {
    sn = cn.replace(/Intel\s+Xeon\s+/i, 'Intel ');
  }
  result.cpu_short_name = sn;

  // 3. cpu_s_name: 索引专用名 (intel6430 / inteli914900 / intelultra9285k)
  result.cpu_s_name = result.cpu_short_name.toLowerCase().replace(/[^a-z0-9]/g, '');

  // ─── 直接映射字段 ─────────────────────────────────────────────────────────
  result.release_date = pickSpec(specMap, ['发行日期', 'Launch Date']);
  result.max_turbo = pickSpec(specMap, ['最大睿频频率', 'Max Turbo Frequency']);
  result.cache = pickSpec(specMap, ['缓存', 'Cache']);
  result.max_memory_capacity = pickSpec(specMap, [
    '最大内存大小（取决于内存类型）',
    '最大内存大小 (取决于内存类型)',
    'Max Memory Size (dependent on memory type)'
  ]) || extractValueFromPageText([
    '最大内存大小（取决于内存类型）',
    '最大内存大小 (取决于内存类型)',
    'Max Memory Size (dependent on memory type)'
  ]);
  result.ecc_support = pickSpec(specMap, [
    '支持的 ECC 内存',
    '支持的 ECC 内存 ‡',
    '支持的ECC内存',
    'ECC Memory Supported'
  ]) || extractValueFromPageText([
    '支持的 ECC 内存',
    '支持的 ECC 内存 ‡',
    '支持的ECC内存',
    'ECC Memory Supported'
  ]);
  result.socket = pickSpec(specMap, ['支持的插槽', 'Sockets Supported']);
  result.memory_speed = pickSpec(specMap, ['内存类型', 'Memory Types']);

  // ─── 需处理字段 ───────────────────────────────────────────────────────────

  // cores: parseInt
  const coresRaw = pickSpec(specMap, ['内核数', 'Total Cores']);
  if (coresRaw) result.cores = String(parseInt(coresRaw) || '');

  // base_freq: 优先取性能核基本频率，降级取通用基本频率
  result.base_freq = pickSpec(specMap, [
    'Performance-core（性能核）基本频率',
    'Performance-core(P-core) 基本频率',
    'Performance-core Base Frequency',
    '处理器基本频率',
    'Processor Base Frequency'
  ]);

  const basePowerLabel = ['处理器基础功耗', 'Processor Base Power'];
  const maxPowerLabel = ['最大睿频功耗', 'Maximum Turbo Power'];
  
  const basePower = pickSpec(specMap, basePowerLabel) || extractValueFromPageText(basePowerLabel);
  const maxPower = pickSpec(specMap, maxPowerLabel) || extractValueFromPageText(maxPowerLabel);
  if (basePower || maxPower) {
    const powerParts = [];
    if (basePower) powerParts.push(`基础 ${basePower}`);
    if (maxPower) powerParts.push(`最大 ${maxPower}`);
    result.tdp = powerParts.join(' / ');
  }

  // memory_channels: parseInt
  const chRaw = pickSpec(specMap, ['最大内存通道数', 'Max # of Memory Channels']);
  if (chRaw) result.memory_channels = String(parseInt(chRaw) || '');

  // max_memory_speed: 从 memory_speed 提取最大 MT/s 数值
  const mtMatch = result.memory_speed.match(/(\d[\d,]+)\s*(?:MT\/s|MHz)/i);
  if (mtMatch) result.max_memory_speed = mtMatch[1].replace(/,/g, '') + ' MT/s';

  // pci: 拼接修订版 + 通道数
  const pcieRev = pickSpec(specMap, ['PCI Express 修订版', 'PCI Express Revision']);
  const pcieLanes = pickSpec(specMap, ['PCI Express 通道数的最大值', 'Max # of PCI Express Lanes']);
  if (pcieRev || pcieLanes) {
    const parts = [];
    if (pcieRev)   parts.push('PCIe ' + pcieRev);
    if (pcieLanes) parts.push(pcieLanes + ' lanes');
    result.pci = parts.join(', ');
  }

  // scalability: 简化 "1S Only" → "1S"，其他保留
  const scalRaw = pickSpec(specMap, ['可扩展性', 'Scalability']);
  result.scalability = scalRaw.replace(/\s*Only$/i, '').trim();

  // ─── 新增字段：GPU ────────────────────────────────────────────────────────
  result.gpu = pickSpec(specMap, [
    '处理器显卡', '显卡名称', '嵌入式显卡', 'GPU Name', 
    'Processor Graphics', 'Graphics Model'
  ]);

  // ─── 新增字段：SKU ────────────────────────────────────────────────────────
  // 优先从 URL 提取，因为 URL 中的 SKU 是最可靠的身份标识
  const urlSkuMatch = location.href.match(/[/-]sku[/-](\d+)(?:[/-]|$)/i);
  if (urlSkuMatch) {
    result.sku = urlSkuMatch[1];
  } else {
    result.sku = pickSpec(specMap, ['SKU']);
  }

  return result;
};
