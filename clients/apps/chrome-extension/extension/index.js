function openInNewTab(event) {
    chrome.tabs.create({url: event.target.href})
}

window.addEventListener("load", function () {
    document.getElementById("button").addEventListener("click", openInNewTab);
});
