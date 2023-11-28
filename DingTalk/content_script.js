$(document).ready(function () {
    $(document.body).on("mouseenter", ".interaction-card-wrapper", function () {
        $(".decline-interaction").attr({"disabled":"disabled"})
    })
    $(document.body).on("mouseleave", ".interaction-card-wrapper", function () {
        $(".decline-interaction").attr({"disabled":"disabled"})
    })
    $(document.body).on("mousemove", ".interaction-card-wrapper", function () {
        $(".decline-interaction").attr({"disabled":"disabled"})
    })
    // 动态生成 report button
    $(document.body).on("click", ".btn.btn-purecloud.btn-success.answer-interaction", function () {
        reportButtonInsert()
    })
    // report button 点击事件 survey_link_button
    $(document.body).on("click", "#report_link_button", function () {
        reportButtonClick()
    })
    //直接插入 report 按钮
    reportButtonInsert()
})

// 声明一些变量
var deptId = {
    "上海-工程部": "所属ID",
    "上海-物流部": "所属ID"
}

var taskId
var xmlHttp
var deptName
var fileName
var fileUrl
var fromTime = ""
var toTime = ""
var fromTimeU
var toTimeU

function reportButtonInsert(){
    // 插入 report button
    var report_button = document.createElement("button")
    report_button.id = "report_link_button"
    report_button.type = "button"
    report_button.className = "ant-btn ant-btn-primary"
    report_button.style = "left: 10px"
    report_button.textContent = "批量导出"
    $("button:last").after(report_button)
}

function reportButtonClick() {  
    //直接读取页面日期控件值
    fromTime = $(".ant-calendar-range-picker-input:eq(0)").attr("value")
    toTime = $(".ant-calendar-range-picker-input:eq(1)").attr("value")
    //unix 时间戳 毫秒
    fromTimeU = Math.round(new Date(fromTime) / 1)
    toTimeU = Math.round(new Date(toTime) / 1)
    reportRun()
}

//钉钉报表处理，由于背景页会自动休眠，造成无法全部正常下载，所以还是放在这边吧。
function creatXMLHttpRequest() {
    var xmlHttp
    if (window.ActiveXObject) {
        return xmlHttp = new ActiveXObject("Microsoft.XMLHTTP")
    } else if (window.XMLHttpRequest) {
        return xmlHttp = new XMLHttpRequest()
    }
}

function fu(xmlHttp, url) {
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
            var result = JSON.parse(xmlHttp.responseText)
            //读取 json 某节点长度，使用 Object.keys().length
            //console.log(Object.keys(result["data"]).length) 
            switch (Object.keys(result["data"]).length) {
                case 5:
                    //读取 id                        
                    taskId = result["data"]["result"]
                    //get 下载文件地址
                    main2()
                    break
                case 2:
                    //progress 到100，就会返回下载文件地址，直接使用
                    if (result["data"]["result"]["progress"] === 100) {
                        fileUrl = result["data"]["result"]["url"]
                        console.log(deptName)
                        //console.log(fileUrl)
                        fileName = deptName + " 钉钉签到报表 " + fromTime + "-" + toTime + ".xls"
                        //console.log(fileName)
                        //download(fileUrl, fileName)//目前使用chrome自带的 downloads
                        //发送消息，下载文件
                        var messageContent = {
                            messageType: "reportDownload",
                            fileUrl: fileUrl,
                            fileName: fileName
                        }
                        chrome.runtime.sendMessage(messageContent, function (response) {
                            console.log(response.markContent)
                        })

                    } else {
                        //如果 progress 还没有运行到 100，间隔1秒再次请求
                        setTimeout(function () {
                            main2()
                        }, 1000)
                    }
                    break
            }
        }
    }
    xmlHttp.open("GET", url, true)
    xmlHttp.send(null)
}

async function reportRun() {
    for (key in deptId) {
        deptName = key
        xmlHttp = creatXMLHttpRequest()
        var url = "https://attendance.dingtalk.com/attendance/web/export/downloadLocal/asyncDownload.json?fromTime="
            + fromTimeU + "&toTime="
            + toTimeU + "&sendMsg=false&deptId="
            + deptId[key]
        fu(xmlHttp, url)
        await sleep(5000)
    }
}

//使用返回的 任务id 来取 下载文件地址
async function main2() {
    xmlHttp1 = creatXMLHttpRequest()
    var url1 = "https://attendance.dingtalk.com/attendance/web/export/downloadLocal/taskProgress.json?taskId="
        + taskId.toString()
    fu(xmlHttp1, url1)
    await sleep(5000)
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

//下载文件 FileSaver.js · GitHub，纯js，方便。目前使用 chrome 自带downlaods
/**
* 获取 blob
* @param  {String} url 目标文件地址
* @return {Promise} 
*/
function getBlob(url) {
    return new Promise(resolve => {
        const xhr = new XMLHttpRequest()

        xhr.open('GET', url, true)
        xhr.responseType = 'blob'
        xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(xhr.response)
            }
        }

        xhr.send()
    })
}

/**
 * 保存
 * @param  {Blob} blob     
 * @param  {String} filename 想要保存的文件名称
 */
function saveAs(blob, filename) {
    if (window.navigator.msSaveOrOpenBlob) {
        navigator.msSaveBlob(blob, filename)
    } else {
        const link = document.createElement('a')
        const body = document.querySelector('body')

        link.href = window.URL.createObjectURL(blob)
        link.download = filename

        // fix Firefox
        link.style.display = 'none'
        body.appendChild(link)

        link.click()
        body.removeChild(link)

        window.URL.revokeObjectURL(link.href)
    }
}

/**
 * 下载
 * @param  {String} url 目标文件地址
 * @param  {String} filename 想要保存的文件名称
 */
function download(url, filename) {
    getBlob(url).then(blob => {
        saveAs(blob, filename)
    })
}