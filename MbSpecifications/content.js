(function () {

  function escapeCSV(value) {
    if (!value) return '';
    value = value.toString();
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  const result = {
    URL: location.href,
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


  const title = document.title;   // "H12DSi-N6 | Motherboards | Super Micro Computer, Inc."
  result.Model = title.split('|')[0].trim();

  const tables = document.querySelectorAll('.sys-spec-table.active-tab table.spec-table-1');

  tables.forEach(table => {

    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {

      const feature = row.querySelector('td.feature');
      const desc = row.querySelector('td.description');
      if (!feature || !desc) return;

      const key = feature.innerText.trim();
      const values = Array.from(desc.querySelectorAll('li'))
        .map(li => li.innerText.trim());

      const text = values.join('; ');

      if (key === 'CPU') {

        result.CPU类型 = values[0] || '';

        values.forEach(v => {

          const socketMatch = v.match(/LGA[-\d+]+/i);
          if (socketMatch) result.CPU接口 = socketMatch[0];

          if (/Dual/i.test(v)) result.几路CPU = '2';
          if (/Single/i.test(v)) result.几路CPU = '1';

          const tdpMatch = v.match(/Up to\s+(\d+W)/i);
          if (tdpMatch) result.最大TDP = tdpMatch[1];
        });
      }

      if (key.includes('Memory Capacity')) {

        const dimmLine = values.find(v => /DIMM\s+slots/i.test(v));
        if (dimmLine) {
          const dimmMatch = dimmLine.match(/(\d+)\s*DIMM/i);
          if (dimmMatch) result.DIMM数量 = dimmMatch[1];
        }

        const maxMemLine = values.find(v => /Up to/i.test(v));
        if (maxMemLine) {
          result.最大内存 = maxMemLine.replace(/Up to/i, '').trim();
        }
      }

      if (key.includes('Memory Type')) {
        result.内存类型 = text;
      }

      if (/PCI(?:e|-E|[-\s]?Express)/i.test(key)) {
        result.PCI分布 = text;

        const matches = text.match(/(\d+)\s*(?:PCI(?:e|-E|[-\s]?Express))/gi);

        if (matches) {
          const total = matches
            .map(m => parseInt(m.match(/\d+/)[0]))
            .reduce((a, b) => a + b, 0);

          result.PCI槽数量 = total.toString();
        }
      }

      if (typeof key === 'string' && key.trim().startsWith('M.2')) {
        const lines = Array.from(desc.querySelectorAll('li'))
          .map(li => li.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean);

        result.M2 = lines.join(' | ');
      }

      if (key.includes('SATA') || key.includes('Storage')) {
        result.存储接口 = text;
      }

    });
  });

  const headers = Object.keys(result);
  const csv = '\uFEFF' +
    headers.join(',') + '\n' +
    headers.map(h => escapeCSV(result[h])).join(',');

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = result.Model + ".csv";
  link.click();

})();