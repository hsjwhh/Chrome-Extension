window.parseAorus = function parseAorus(doc = document) {
  const result = {
    URL: (doc.location || location).href,
    Model: '',
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

  // 1. 获取型号 (根据网址提取，例如 ../motherboards/TRX50-AERO-D-rev-12/Specification)
  const loc = doc.location || location;
  const segments = loc.pathname.replace(/\/$/, "").split("/");
  if (segments[segments.length - 1] === "Specification") {
    result.Model = segments[segments.length - 2] || "";
  } else {
    // 兼容可能没有 /Specification 的情况
    result.Model = segments[segments.length - 1] || "";
  }

  // 2. 辅助函数：通过左侧标签获取右侧内容
  function getValueByLabel(labelKeyword) {
    const labels = Array.from(doc.querySelectorAll('.tableDataBox1 .tableDataBox'));
    const targetLabel = labels.find(el => el.innerText.trim().includes(labelKeyword));
    if (targetLabel && targetLabel.id) {
        const valueEl = doc.querySelector(`.tableDataBox2 #${targetLabel.id}`);
        return valueEl ? valueEl.innerText.trim() : '';
    }
    return '';
  }

  // 3. 提取各个字段原始文本
  result.CPU类型 = getValueByLabel('CPU');
  const memoryText = getValueByLabel('Memory');
  result.内存类型 = memoryText;
  result.PCI分布 = getValueByLabel('Expansion Slots');
  result.存储接口 = getValueByLabel('Storage Interface');
  
  // 4. 解析 CPU 接口与路数
  const SOCKET_PATTERN = /\b(?:AM\d+|LGA[- ]?\d+|SP\d+|sTR\d+|TR\d+|sTRX\d+|sWRX\d+)\b/i;
  const socketMatch = result.CPU类型.match(SOCKET_PATTERN);
  if (socketMatch) result.CPU接口 = socketMatch[0];
  
  if (/dual/i.test(result.CPU类型)) {
    result.几路CPU = '2';
  } else if (/single/i.test(result.CPU类型)) {
    result.几路CPU = '1';
  }

  const tdpMatch = result.CPU类型.match(/up to\s+(\d+W)/i) || result.CPU类型.match(/(\d+W)\s*TDP/i);
  if (tdpMatch) result.最大TDP = tdpMatch[1];

  // 5. 解析内存 (DIMM 数量, 最大容量)
  const dimmMatch = memoryText.match(/(\d+)\s*x\s*DDR\d/i) || memoryText.match(/(\d+)\s*(?:x\s*)?DIMM/i);
  if (dimmMatch) {
    result.DIMM数量 = dimmMatch[1];
  }
  
  const maxMemMatch = memoryText.match(/(?:support|up to)[^\d]*([\d.]+\s*(?:TB|GB|MB))/i);
  if (maxMemMatch) {
    result.最大内存 = maxMemMatch[1].replace(/\s+/g, '');
  }

  // 6. 解析 PCI 槽数量
  const pcieCountMatch = result.PCI分布.match(/(\d+)\s*x\s*PCI Express/gi);
  if (pcieCountMatch) {
    let total = 0;
    pcieCountMatch.forEach(match => {
      const numMatch = match.match(/(\d+)/);
      if (numMatch) total += parseInt(numMatch[1], 10);
    });
    if (total > 0) result.PCI槽数量 = total.toString();
  }

  // 7. 解析 M.2
  const m2Matches = result.存储接口.split('\n').filter(line => /M\.2/i.test(line));
  if (m2Matches.length > 0) {
    result.M2 = m2Matches.map(l => l.trim().replace(/^- /g, '')).join(' | ');
  }

  return result;
};

window.findAorusLinks = function findAorusLinks(doc = document) {
  const links = [];
  const seen = new Set();
  
  // Aorus 列表： https://www.aorus.com/zh-tw/motherboards/ ...
  doc.querySelectorAll('a').forEach(a => {
    const href = a.href;
    if (href && href.includes('/motherboards/') && !seen.has(href)) {
        // 排除列表筛选器
        if (href.includes('?') || href.includes('#')) return;
        
        let name = a.innerText.trim();
        // Aorus 卡片通常有 h5.card-title
        if (!name && a.querySelector('.card-title')) {
            name = a.querySelector('.card-title').innerText.trim();
        }
        
        if (name && name.length > 2 && !/More/i.test(name)) {
            links.push({ url: href, name: name });
            seen.add(href);
        }
    }
  });
  
  return links;
};;
