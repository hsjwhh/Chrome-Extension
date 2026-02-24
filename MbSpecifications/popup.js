const btn = document.getElementById("scrapeBtn");

btn.addEventListener("click", () => {
  btn.disabled = true;
  btn.textContent = "...";

  chrome.runtime.sendMessage({ action: "scrape" }, (resp) => {
    btn.disabled = false;
    btn.textContent = "S";

    if (!resp) return;

    if (resp.status === "unsupported_site") {
      btn.textContent = "✗";
      setTimeout(() => { btn.textContent = "S"; }, 1500);
    } else if (resp.status === "already_running") {
      btn.textContent = "~";
      setTimeout(() => { btn.textContent = "S"; }, 1500);
    }
    // "started" / "error" 均由页面内 Toast 给用户反馈
  });
});