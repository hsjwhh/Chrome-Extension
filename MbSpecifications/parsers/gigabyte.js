window.parseGigabyte = function parseGigabyte() {

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
    const path = location.pathname.replace(/\/$/, "");
    const segments = path.split("/");
    return segments[segments.length - 1] || "";
  }

  const result = {
    URL:       location.href,
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
  document.querySelectorAll("#Section-Specifications .SpecItem").forEach(item => {
    const title = item.querySelector(".Title")?.innerText?.trim();
    const desc  = item.querySelector(".Desc")?.innerText?.trim();
    if (title && desc) specMap[title] = desc;
  });

  // ─── CPU ──────────────────────────────────────────────────────────────────
  const cpuRaw    = specMap["Processor Supported"] || '';
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
  const memRaw = specMap["Memory Type"] || '';

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
  const pcieRaw = specMap["PCIe Expansion Slots"] || '';

  // 只统计明确写 "Slot_N: PCIe" 或 "N x PCIe" 格式的行，排除 MCIO/备注
  const slotCount = pcieRaw
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^Slot_\d+:/i.test(l) && /PCIe/i.test(l))
    .length;
  if (slotCount > 0) result.PCI槽数量 = slotCount.toString();

  result.PCI分布 = flatten(pcieRaw);

  // ─── 存储 ─────────────────────────────────────────────────────────────────
  const storageRaw = specMap["Storage Interface"] || '';
  result.存储接口 = flatten(storageRaw);

  // M.2：提取含 M.2 的数据行，去掉纯标题行（如 "M.2:"）和备注行
  const m2Lines = storageRaw
    .split('\n')
    .map(l => l.trim())
    .filter(l => /M\.2/i.test(l) && !/^\[/.test(l) && !/^M\.2:$/i.test(l));
  result.M2 = m2Lines.join(' ; ');

  return result;
}