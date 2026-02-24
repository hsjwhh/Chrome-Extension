(async function () {

  const parserMap = [
    {
      match: host => host.includes("supermicro.com"),
      module: "./parsers/supermicro.js",
      exportName: "parseSupermicro"
    },
    {
      match: host => host.includes("gigabyte.cn"),
      module: "./parsers/gigabyte.js",
      exportName: "parseGigabyte"
    }
  ];

  const item = parserMap.find(p => p.match(location.hostname));

  if (!item) {
    alert("当前网站不支持");
    return;
  }

  try {
    const module = await import(chrome.runtime.getURL(item.module));
    const parser = module[item.exportName];

    if (!parser) {
      alert("解析器不存在");
      return;
    }

    const result = parser();

    if (!result) {
      alert("解析失败");
      return;
    }

    exportCSV(result);

  } catch (e) {
    console.error(e);
    alert("加载解析器失败");
  }

})();

function exportCSV(result) {
  function escapeCSV(value) {
    if (!value) return '';
    value = value.toString();
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // 统一导出
  const headers = Object.keys(result);
  const csv = '\uFEFF' +
    headers.join(',') + '\n' +
    headers.map(h => escapeCSV(result[h])).join(',');

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = result.Model + ".csv";
  link.click();

}