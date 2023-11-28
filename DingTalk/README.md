# DIngTalk

项目自用的 chrome extension

批量导出钉钉签到报表


###一些注意点
* popup或者bg向content主动发送消息:
```javascript
function sendMessageToContentScript(message, callback)
{
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs)
	{
		chrome.tabs.sendMessage(tabs[0].id, message, function(response)
		{
			if(callback) callback(response);
		});
	});
}
sendMessageToContentScript({cmd:'test', value:'你好，我是popup！'}, function(response)
{
	console.log('来自content的回复：'+response);
});
```

* content-script.js接收：
```javascript
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse)
{
	// console.log(sender.tab ?"from a content script:" + sender.tab.url :"from the extension");
	if(request.cmd == 'test') alert(request.value);
	sendResponse('我收到了你的消息！');
});
```
```
双方通信直接发送的都是JSON对象，不是JSON字符串，所以无需解析，很方便（当然也可以直接发送字符串）。
```

*  获取当前标签页ID
```javascript
  // 获取当前选项卡ID
  function getCurrentTabId(callback)
  {
  	chrome.tabs.query({active: true, currentWindow: true}, function(tabs)
  	{
  		if(callback) callback(tabs.length ? tabs[0].id: null);
  	});
  }
```