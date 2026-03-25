window.parseSupermicro = function parseSupermicro(doc = document) {
  const SOCKET_PATTERN = /\b(?:AM\d+|LGA[- ]?\d+|SP\d+|sTR\d+|TR\d+|sTRX\d+|sWRX\d+)\b/i;
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

  const title = doc.title || '';
  result.Model = title.split('|')[0].trim();

  // ─── 第一优先级：从 Key Features (概览页) 提取数据 ────────────────────────
  const kfList = doc.querySelectorAll('.key-feature-list li');
  if (kfList.length > 0) {
    kfList.forEach(li => {
      const text = li.innerText.trim();

      // 提取 CPU/路数/接口
      if (!result.CPU类型 && /processor/i.test(text)) {
        result.CPU类型 = text;
      }
      if (!result.几路CPU) {
        if (/Dual Socket/i.test(text)) result.几路CPU = '2';
        else if (/Single Socket/i.test(text)) result.几路CPU = '1';
      }
      if (!result.CPU接口) {
        const socketMatch = text.match(SOCKET_PATTERN);
        if (socketMatch) result.CPU接口 = socketMatch[0];
      }

      // 提取 TDP
      if (!result.最大TDP) {
        const tdpMatch = text.match(/(\d+W)\s*TDP/i) || text.match(/up to\s+(\d+W)/i);
        if (tdpMatch) result.最大TDP = tdpMatch[1];
      }

      // 提取 内存 (DIMM 数量, 类型, 最大容量)
      if (!result.DIMM数量) {
        const dimmMatch = text.match(/(\d+)\s*DIMM\s*slots/i);
        if (dimmMatch) result.DIMM数量 = dimmMatch[1];
      }
      if (!result.内存类型 && /DDR\d/i.test(text)) {
        const memPart = text.match(/DDR\d[-\w\/]*/i);
        if (memPart) result.内存类型 = memPart[0];
      }
      if (!result.最大内存 && /Up to\s+[\d.]+[TB|GB]/i.test(text)) {
        const maxMemMatch = text.match(/Up to\s+([\d.]+[TB|GB])/i);
        if (maxMemMatch) result.最大内存 = maxMemMatch[1];
      }

      // 提取 M.2
      if (!result.M2 && /M\.2/i.test(text)) {
        result.M2 = text;
      }
    });
  }

  // ─── 第二优先级：从详细规格表 (Specifications) 补全缺失数据 ───────────────
  const tables = doc.querySelectorAll('.sys-spec-table.active-tab table.spec-table-1, .tab-specs-more.active table.spec-table-1, table.spec-table-1');

  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const feature = row.querySelector('td.feature');
      const desc = row.querySelector('td.description');
      if (!feature || !desc) return;

      const key = feature.innerText.trim();
      const values = Array.from(desc.querySelectorAll('li')).map(li => li.innerText.trim());
      const text = values.join('; ');

      // CPU 相关补全
      if (key === 'CPU') {
        if (!result.CPU类型) result.CPU类型 = values[0] || '';

        values.forEach(v => {
          if (!result.CPU接口) {
            const socketMatch = v.match(SOCKET_PATTERN);
            if (socketMatch) result.CPU接口 = socketMatch[0];
          }
          if (!result.几路CPU) {
            if (/Dual/i.test(v)) result.几路CPU = '2';
            else if (/Single/i.test(v)) result.几路CPU = '1';
          }
          if (!result.最大TDP) {
            const tdpMatch = v.match(/Up to\s+(\d+W)/i);
            if (tdpMatch) result.最大TDP = tdpMatch[1];
          }
        });
      }

      // 内存容量补全
      if (key.includes('Memory Capacity')) {
        if (!result.DIMM数量) {
          const dimmLine = values.find(v => /DIMM\s+slots/i.test(v));
          if (dimmLine) {
            const dimmMatch = dimmLine.match(/(\d+)\s*DIMM/i);
            if (dimmMatch) result.DIMM数量 = dimmMatch[1];
          }
        }
        if (!result.最大内存) {
          const maxMemLine = values.find(v => /Up to/i.test(v));
          if (maxMemLine) result.最大内存 = maxMemLine.replace(/Up to/i, '').trim();
        }
      }

      // 内存类型补全
      if (key.includes('Memory Type') && !result.内存类型) {
        result.内存类型 = text;
      }

      // PCI 相关
      if (/PCI(?:e|-E|[-\s]?Express)/i.test(key)) {
        if (!result.PCI分布) result.PCI分布 = text;
        if (!result.PCI槽数量) {
          const matches = text.match(/(\d+)\s*(?:PCI(?:e|-E|[-\s]?Express))/gi);
          if (matches) {
            const total = matches
              .map(m => parseInt(m.match(/\d+/)[0]))
              .reduce((a, b) => a + b, 0);
            result.PCI槽数量 = total.toString();
          }
        }
      }

      // M.2 补全
      if (key.trim().startsWith('M.2') && !result.M2) {
        const lines = Array.from(desc.querySelectorAll('li'))
          .map(li => li.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        result.M2 = lines.join(' | ');
      }

      // 存储接口
      if ((key.includes('SATA') || key.includes('Storage')) && !result.存储接口) {
        result.存储接口 = text;
      }
    });
  });

  return result;
};

window.findSupermicroLinks = function findSupermicroLinks(doc = document) {
  const links = [];
  const seen = new Set();
  
  // Supermicro 列表页通常是 /en/products/motherboard
  // 链接通常在表格中，或者卡片中
  doc.querySelectorAll('a').forEach(a => {
    const href = a.href;
    if (href && href.includes('/en/products/motherboard/') && !seen.has(href)) {
        if (href.includes('?')) return;
        
        // 排除非产品页 (如索引页，PDF 等)
        if (href.endsWith('.pdf')) return;

        let name = a.innerText.trim();
        // 尝试从行内其他元素获取型号（Supermicro 列表通常是表格，第一列是型号）
        if (!name && a.closest('tr')) {
            const modelCell = a.closest('tr').querySelector('td a');
            if (modelCell) name = modelCell.innerText.trim();
        }

        if (name && name.length > 3 && !/view all/i.test(name)) {
            links.push({ url: href, name: name });
            seen.add(href);
        }
    }
  });
  
  return links;
};
