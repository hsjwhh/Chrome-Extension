window.parseGigabyte = function parseGigabyte(doc = document) {

  // ─── 文本清理：多行 → 单行 ───────────────────────────────────────────────
  // 1. 按换行拆分
  // 2. 丢弃备注行（以 [1] [2] [Note] [*] 开头的行）
  // 3. 丢弃空行
  // 4. 剩余行用 " ; " 拼接
  function flatten(text) {
    if (!text) return '';
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !/^\[(\d+|\*|Note)\]/i.test(line))
      .join(' ; ');
  }

  // ─── 从 URL 取型号 ────────────────────────────────────────────────────────
  function getModelFromURL() {
    // 优先使用 doc.location (如果是真实 document)，否则使用传入的 mock location 或者空
    const loc = doc.location || location;
    const path = loc.pathname.replace(/\/$/, "");
    const segments = path.split("/");
    return segments[segments.length - 1] || "";
  }

  const result = {
    URL:       (doc.location || location).href,
    Model:     getModelFromURL(),
    CPU类型:   '',
    CPU接口:   '',
    几路CPU:   '',
    最大TDP:   '',
    内存类型:  '',
    DIMM数量:  '',
    最大内存:  '',
    PCI槽数量: '',
    PCI分布:   '',
    M2:        '',
    存储接口:  ''
  };

  // ─── 读取页面规格表 ───────────────────────────────────────────────────────
  const specMap = {};
  doc.querySelectorAll("#Section-Specifications .SpecItem").forEach(item => {
    const title = item.querySelector(".Title")?.innerText?.trim();
    const desc  = item.querySelector(".Desc")?.innerText?.trim();
    if (title && desc) specMap[title] = desc;
  });

  // ─── CPU ──────────────────────────────────────────────────────────────────
  const cpuRaw    = specMap["Processor Supported"] || specMap["CPU"] || '';
  const cpuSocket = specMap["Socket"] || '';

  // CPU类型：去备注行 + cTDP 行（cTDP 数据已提取到最大TDP）
  result.CPU类型 = cpuRaw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !/^\[/.test(l) && !/^cTDP/i.test(l))
    .join(' ; ');

  result.CPU接口 = flatten(cpuSocket);

  if (/dual/i.test(cpuRaw))        result.几路CPU = '2';
  else if (/single/i.test(cpuRaw)) result.几路CPU = '1';

  const tdpMatch = cpuRaw.match(/cTDP up to\s+(\d+W)/i)
                || cpuRaw.match(/up to\s+(\d+W)/i);
  if (tdpMatch) result.最大TDP = tdpMatch[1];

  // ─── 内存 ─────────────────────────────────────────────────────────────────
  const memRaw = specMap["Memory Type"] || specMap["Memory"] || '';

  const dimmMatch = memRaw.match(/(\d+)\s*x\s*DIMM/i);
  if (dimmMatch) result.DIMM数量 = dimmMatch[1];

  // 最大内存速率：取所有 MT/s 数值中最大的
  const mtMatches = [...memRaw.matchAll(/(\d+)\s*MT\/s/g)];
  if (mtMatches.length) {
    const max = Math.max(...mtMatches.map(m => parseInt(m[1])));
    result.最大内存 = max + ' MT/s';
  }

  result.内存类型 = flatten(memRaw);

  // ─── PCI ──────────────────────────────────────────────────────────────────
  const pcieRaw = specMap["PCIe Expansion Slots"] || specMap["Expansion Slots"] || '';

  // 只统计明确写 "Slot_N: PCIe" 或 "N x PCIe" 格式的行，排除 MCIO/备注
  const slotCount = pcieRaw
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^Slot_\d+:/i.test(l) && /PCIe/i.test(l))
    .length;
  if (slotCount > 0) result.PCI槽数量 = slotCount.toString();

  result.PCI分布 = flatten(pcieRaw);

  // ─── 存储 ─────────────────────────────────────────────────────────────────
  const storageRaw = [specMap["Storage Interface"], specMap["SATA"], specMap["SAS"]].filter(Boolean).join('\n');
  result.存储接口 = flatten(storageRaw);

  // M.2：提取含 M.2 的数据行，去掉纯标题行（如 "M.2:"）和备注行
  const m2Source = [storageRaw, pcieRaw, specMap["Internal I/O"]].filter(Boolean).join('\n');
  const m2Lines = m2Source
    .split('\n')
    .map(l => l.trim())
    .filter(l => /M\.2/i.test(l) && !/^\[/.test(l) && !/^M\.2:$/i.test(l));
  result.M2 = [...new Set(m2Lines)].join(' ; ');

  return result;
};

window.findGigabyteLinks = function findGigabyteLinks(doc = document) {
  const links = [];
  // 针对列表页：提取所有产品详情链接
  // 选择器需要根据实际列表页结构调整，这里假设常见的 .ProductList .ProductItem a
  // 也可以从所有 a 标签中筛选符合 /Enterprise/Server-Motherboard/xxx 的链接
  const seen = new Set();
  
  doc.querySelectorAll('a').forEach(a => {
    const href = a.href;
    // 过滤条件：包含 Server-Motherboard 且不包含 #, javascript 等，且要是详情页（通常没有 query 参数或者特定结构）
    // 详情页示例: https://www.gigabyte.cn/Enterprise/Server-Motherboard/MS03-CE0-rev-10
    if (href && href.includes('/Enterprise/Server-Motherboard/') && !seen.has(href)) {
        // 简单排除列表页自身的过滤参数
        if (href.includes('?')) return;
        
        // 提取型号名作为 label
        let name = a.innerText.trim();
        if (!name) {
            const img = a.querySelector('img');
            if (img) name = img.alt || img.title;
        }
        
        // 只有当名字存在且看起来像型号时才添加
        if (name && name.length > 3) {
            links.push({ url: href, name: name });
            seen.add(href);
        }
    }
  });
  
  return links;
};