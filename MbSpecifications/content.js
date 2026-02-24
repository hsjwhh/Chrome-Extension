(function () {

  // background.js 已提前注入了对应的 parser 文件，并通过 window.__scraper_parser_name__ 告知函数名
  const parserName = window.__scraper_parser_name__;

  if (!parserName || typeof window[parserName] !== 'function') {
    showToast('❌ 解析器未找到：' + (parserName || '未指定'));
    return;
  }

  let result;
  try {
    result = window[parserName]();
  } catch (e) {
    console.error('[Scraper] 解析出错:', e);
    showToast('❌ 解析失败，请查看控制台');
    return;
  }

  if (!result) {
    showToast('❌ 解析结果为空');
    return;
  }

  exportCSV(result);
  showToast('✅ 已导出：' + (result.Model || 'CSV'));

  // 导出完成后清除 parser 名，允许刷新页面后重新抓取
  delete window.__scraper_parser_name__;

})();

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function exportCSV(result) {
  function escapeCSV(value) {
    if (value == null) return '';
    value = value.toString();
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  const headers = Object.keys(result);
  const csv = '\uFEFF' +
    headers.join(',') + '\n' +
    headers.map(h => escapeCSV(result[h])).join(',');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = (result.Model || 'export') + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href); // 释放内存
}

function showToast(msg) {
  // 避免重复显示
  const existing = document.getElementById('__scraper_toast__');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = '__scraper_toast__';
  div.textContent = msg;
  Object.assign(div.style, {
    position:     'fixed',
    top:          '20px',
    right:        '20px',
    zIndex:       '2147483647',
    background:   '#1a1a2e',
    color:        '#fff',
    padding:      '10px 18px',
    borderRadius: '8px',
    fontSize:     '14px',
    fontFamily:   'sans-serif',
    boxShadow:    '0 4px 12px rgba(0,0,0,0.3)',
    transition:   'opacity 0.4s ease',
    opacity:      '1'
  });

  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 400);
  }, 3000);
}