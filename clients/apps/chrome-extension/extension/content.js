const taskLists = document.querySelector("task-lists");
if (taskLists) {
    const badge = document.createElement("p");
    badge.textContent = "Hello from the Chrome Extension!";
    taskLists.insertAdjacentElement("afterend", badge);
}
