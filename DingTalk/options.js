//默认选择
chrome.storage.local.get('dingTalkReportDate', function (valueArray) {
	var reportDate = JSON.parse(valueArray.dingTalkReportDate);
	//console.log(dingTalkReportDate.type);
	document.getElementById('dateFrom').value = reportDate["from"];
	document.getElementById('dateTo').value = reportDate["to"];
});
//保存选项
document.getElementById('optionFlush').onclick = function () {
	var dateFrom = document.getElementById('dateFrom').value,
		dateTo = document.getElementById('dateTo').value;
	var reportDate = {
		"from": dateFrom,
		"to": dateTo
	};
	chrome.storage.local.set({ 'dingTalkReportDate': JSON.stringify(reportDate) }, function () {
		//alert('保存成功');
		//刷新  重新加载应用
		//chrome.runtime.reload();
	});
}