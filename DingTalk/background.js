//设置badge文字和颜色,只支持4个以下的字符
chrome.browserAction.setBadgeText({ text: 'beta' })
chrome.browserAction.setBadgeBackgroundColor({ color: [192, 192, 192, 1] })
/***
 * content_script 直接读取页面控件中的日期信息，所以不需要这步操作
//读取配置中存储的日期信息
var reportDate
chrome.storage.local.get('dingTalkReportDate', function (valueArray) {
    reportDate = JSON.parse(valueArray.dingTalkReportDate)
})
***/
// 点击扩展图标后的提示
chrome.browserAction.onClicked.addListener(
    function (tab) {
        //show("无需点击，工具已开启!")
        }
)

// 追踪数据对象的更改，可以向 onChanged 事件添加监听器，每当存储有任何更改时将会产生该事件。
// 如下是监听对已保存内容的更改的示例代码
chrome.storage.onChanged.addListener(function (changes, namespace) {
    for (key in changes) {
        var storageChange = changes[key]
        console.log('存储键“%s”（位于“%s”命名空间中）已更改。' +
            '原来的值为“%s”，新的值为“%s”。',
            key,
            namespace,
            storageChange.oldValue,
            storageChange.newValue)
    }
})

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request.messageType.trim()) {
        case "reportGo":
            show("批量报表导出中......")
            sendResponse({ markContent: "批量报表导出中......" })   

            /***
             * content_script 直接读取页面控件中的日期信息，所以不需要这部操作
            //返回之前读取的配置中存储的日期信息
            sendResponse({ markContent: reportDate })
            ***/
            break        
        case "reportDownload":
            sendResponse({ markContent: "批量报表下载中......" })
            //开始下载文件
            downloadFile(request.fileUrl, request.fileName)            
            break
        default:
            sendResponse({ markContent: "messageType is null!" })
            break
    }
})

//显示网站通知
function show(msgStr) {
    var counter = 5
    chrome.notifications.create(
        'DingTalkReportNotification',
        {type: 'basic', iconUrl: 'images/PNG_38.png', title: 'DingTalk Report Notification', message: msgStr},
        function () {
            counterTimer = setInterval(function () {
                counter -= 1
                //chrome.notifications.update('DingTalkReportNotification', {
                    //    contextMessage: counter + 's后自动关闭'
                    //})
                if (counter === 0) {
                    clearInterval(counterTimer)
                    chrome.notifications.clear('DingTalkReportNotification')
                }
            }, 1000)
        })
}

//直接调用 chrome.downloads.download ，简单方便快捷
//文件名冲突的处理方式，Enum 类型，可选值包括 uniquify、overwrite、prompt：
//uniquify：如果冲突了在文件后缀的前面加上计数，比如 filename1.jpg, filename2.jpg
//overwrite: 新文件覆盖旧的文件
//prompt：用户会受到一个 dialog 确认操作
function downloadFile(fileUrl, fileName) {
    var options = {
        url: fileUrl,
        filename: fileName,
        conflictAction: "uniquify"
    }
    chrome.downloads.download(options, (res) => {
        console.log(res)
    })
}
