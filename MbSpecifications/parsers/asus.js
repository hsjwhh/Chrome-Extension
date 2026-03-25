window.parseAsus = function parseAsus(doc = document) {
  const SOCKET_PATTERN = /\b(?:AM\d+|LGA[- ]?\d+|SP\d+|sTR\d+|TR\d+|sTRX\d+|sWRX\d+)\b/i;
  const result = {
    URL: (doc.location || location).href,
    Model: "",
    CPU类型: "",
    CPU接口: "",
    几路CPU: "",
    最大TDP: "",
    内存类型: "",
    DIMM数量: "",
    最大内存: "",
    PCI槽数量: "",
    PCI分布: "",
    M2: "",
    存储接口: ""
  };

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitLines(value) {
    return String(value || "")
      .split("\n")
      .map(line => cleanText(line))
      .filter(Boolean);
  }

  function pickFirstMatch(lines, pattern) {
    const found = lines.find(line => pattern.test(line));
    return found || "";
  }

  function buildSpecMap(lines) {
    const titles = [
      "Model",
      "CPU",
      "Chipset",
      "Memory",
      "Graphics",
      "Expansion Slots",
      "Storage",
      "RAID Support",
      "Ethernet",
      "Wireless & Bluetooth",
      "USB",
      "Audio",
      "Back Panel I/O Ports",
      "Internal I/O Connectors",
      "Special Features",
      "Software Features",
      "Remote Management Features",
      "BIOS",
      "Manageability",
      "Accessories",
      "Operating System",
      "Form Factor"
    ];
    const stopMarkers = new Set([
      "News & Updates",
      "Need Help?",
      "Shop and Learn"
    ]);
    const indices = new Map();

    lines.forEach((line, index) => {
      if (titles.includes(line) && !indices.has(line)) {
        indices.set(line, index);
      }
    });

    const specMap = {};
    titles.forEach((title, titleIndex) => {
      if (!indices.has(title)) return;

      const start = indices.get(title) + 1;
      let end = lines.length;

      for (let i = titleIndex + 1; i < titles.length; i += 1) {
        const nextTitle = titles[i];
        if (indices.has(nextTitle)) {
          end = indices.get(nextTitle);
          break;
        }
      }

      const values = lines
        .slice(start, end)
        .filter(line => line && !stopMarkers.has(line));

      specMap[title] = values;
    });

    return specMap;
  }

  const lines = splitLines(doc.body.innerText);
  const titleHeading =
    cleanText(doc.querySelector("h1")?.textContent) ||
    cleanText(doc.title.split("|")[0]);
  if (titleHeading) result.Model = titleHeading;

  const specMap = buildSpecMap(lines);
  if (!result.Model && specMap.Model?.[0]) {
    result.Model = specMap.Model[0];
  }

  const cpuLines = specMap["CPU"] || [];
  const memoryLines = specMap["Memory"] || [];
  const pcieLines = specMap["Expansion Slots"] || [];
  const storageLines = specMap["Storage"] || [];

  result.CPU类型 = cpuLines.join("; ");

  const socketMatch = result.CPU类型.match(SOCKET_PATTERN);
  if (socketMatch) result.CPU接口 = socketMatch[0].replace(/\s+/g, "");

  if (/single/i.test(result.CPU类型) || /desktop processors/i.test(result.CPU类型)) {
    result.几路CPU = "1";
  } else if (/dual/i.test(result.CPU类型)) {
    result.几路CPU = "2";
  }

  const tdpMatch = result.CPU类型.match(/(\d+W)/i);
  if (tdpMatch) result.最大TDP = tdpMatch[1];

  const dimmMatch = memoryLines.join(" ").match(/(\d+)\s*x\s*DIMM/i);
  if (dimmMatch) result.DIMM数量 = dimmMatch[1];

  const maxMemoryMatch = memoryLines.join(" ").match(/max\.?\s*([\d.]+\s*(?:TB|GB))/i);
  if (maxMemoryMatch) result.最大内存 = cleanText(maxMemoryMatch[1]);

  const memoryTypeLine = pickFirstMatch(memoryLines, /DDR\d/i);
  if (memoryTypeLine) {
    const memoryTypeMatch = memoryTypeLine.match(/DDR\d[^,;]*/i);
    result.内存类型 = memoryTypeMatch ? cleanText(memoryTypeMatch[0]) : memoryTypeLine;
  }

  const pcieSlotLines = pcieLines.filter(line => /PCIe/i.test(line) && /\bx\d+/i.test(line));
  if (pcieSlotLines.length) {
    result.PCI分布 = pcieSlotLines.join("; ");
    const totalSlots = pcieSlotLines.reduce((sum, line) => {
      const countMatch = line.match(/(\d+)\s*x\s*PCIe/i);
      return sum + (countMatch ? parseInt(countMatch[1], 10) : 0);
    }, 0);
    if (totalSlots > 0) result.PCI槽数量 = String(totalSlots);
  }

  const m2Lines = storageLines.filter(line => /M\.2/i.test(line));
  if (m2Lines.length) result.M2 = m2Lines.join(" | ");

  const storageSummary = [];
  const totalStorageLine = pickFirstMatch(storageLines, /Total supports/i);
  if (totalStorageLine) storageSummary.push(totalStorageLine);
  const sataLine = pickFirstMatch(storageLines, /SATA\s*6Gb\/s/i);
  if (sataLine && sataLine !== totalStorageLine) storageSummary.push(sataLine);
  result.存储接口 = storageSummary.join("; ");

  return result;
};

window.findAsusLinks = function findAsusLinks(doc = document) {
  const links = [];
  const seen = new Set();

  // Asus 列表页： /motherboards-components/motherboards/All-series/
  // 卡片中的链接通常指向 /motherboards-components/motherboards/MODEL_NAME/
  doc.querySelectorAll('a').forEach(a => {
    const href = a.href;
    if (href && href.includes('/motherboards-components/motherboards/') && !seen.has(href)) {
       // 排除列表页自己
       if (href.endsWith('/All-series/') || href.includes('/filter/')) return;
       
       let name = a.innerText.trim();
       // 尝试从 img alt 获取
       if (!name) {
           const img = a.querySelector('img');
           if (img) name = img.alt;
       }
       
       // Asus 产品卡片通常有个 heading
       if (!name && a.querySelector('div[class*="productName"]')) {
           name = a.querySelector('div[class*="productName"]').innerText.trim();
       }

       if (name && name.length > 2) {
           links.push({ url: href, name: name });
           seen.add(href);
       }
    }
  });

  return links;
};
