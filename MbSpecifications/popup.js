document.getElementById("scrapeBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "scrape" }, (resp) => {
    console.log(resp.status); // "started"
  });
});