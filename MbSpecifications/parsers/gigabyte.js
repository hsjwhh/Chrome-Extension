export function parseGigabyte() {

  function getModelFromURL() {
    const path = location.pathname.replace(/\/$/, "");
    const segments = path.split("/");
    return segments[segments.length - 1] || "";
  }

  const result = {
    URL: location.href,
    Model: getModelFromURL(),
    CPU类型: '',
    CPU接口: '',
    几路CPU: '',
    最大TDP: '',
    内存类型: '',
    DIMM数量: '',
    最大内存: '',
    PCI槽数量: '',
    PCI分布: '',
    M2: '',
    存储接口: ''
  };

  const specItems = document.querySelectorAll(
    "#Section-Specifications .SpecItem"
  );

  const specMap = {};

  specItems.forEach(item => {
    const title = item.querySelector(".Title")?.innerText?.trim();
    const desc = item.querySelector(".Desc")?.innerText?.trim();
    if (title && desc) specMap[title] = desc;
  });

  // ======================
  // CPU
  // ======================

  const cpuInfo = specMap["Processor Supported"] || '';

  result.CPU类型 = cpuInfo;

  const cpuSocket = specMap["Socket"] || '';
  result.CPU接口 = cpuSocket;

  // 几路CPU
  if (/dual/i.test(cpuInfo)) result.几路CPU = '2';
  else if (/single/i.test(cpuInfo)) result.几路CPU = '1';

  // 最大TDP
  const tdpMatch = cpuInfo.match(/up to\s+(\d+W)/i);
  if (tdpMatch) result.最大TDP = tdpMatch[1];

  // ======================
  // 内存
  // ======================

  const memoryInfo = specMap["Memory Type"] || '';

  result.内存类型 = memoryInfo;

  const dimmMatch = memoryInfo.match(/(\d+)\s*x\s*DIMM/i);
  if (dimmMatch) result.DIMM数量 = dimmMatch[1];

  const maxMemMatch = memoryInfo.match(/Up to\s+([^\n]+)/i);
  if (maxMemMatch) result.最大内存 = maxMemMatch[1].trim();

  // ======================
  // PCI
  // ======================

  const pcieInfo = specMap["PCIe Expansion Slots"] || '';

  result.PCI分布 = pcieInfo;

  const slotMatches = pcieInfo.match(/(\d+)\s*x\s*PCIe/gi);
  if (slotMatches) {
    let total = 0;
    slotMatches.forEach(m => {
      const num = parseInt(m.match(/\d+/)[0]);
      total += num;
    });
    result.PCI槽数量 = total.toString();
  }

  // ======================
  // 存储
  // ======================

  const storageInfo = specMap["Storage Interface"] || '';
  result.存储接口 = storageInfo;

  const m2Match = storageInfo.match(/(\d+)\s*x\s*M\.2/i);
  if (m2Match) result.M2 = m2Match[1];

  return result;
}