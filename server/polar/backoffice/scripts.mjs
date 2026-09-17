import htmx from "htmx.org";
import "hyperscript.org";
import { EventSourcePlus } from "event-source-plus";

window.htmx = htmx;

// Full HTML swapped into #content nests the sidebar inside itself.
const extractContentSwapPartial = (html) => {
  if (!/<html[\s>]/i.test(html)) {
    return null;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const content = doc.getElementById("content");
  if (!content) {
    return null;
  }
  const pieces = [content.innerHTML];
  for (const el of doc.querySelectorAll("[hx-swap-oob], [data-hx-swap-oob]")) {
    if (content.contains(el)) {
      continue;
    }
    pieces.push(el.outerHTML);
  }
  return pieces.join("");
};

document.addEventListener("htmx:beforeSwap", (event) => {
  const { target, serverResponse } = event.detail;
  if (!target || target.id !== "content" || typeof serverResponse !== "string") {
    return;
  }
  const partial = extractContentSwapPartial(serverResponse);
  if (partial !== null) {
    event.detail.serverResponse = partial;
  }
});

const formPostSSE = (formElement, target) => {
  const eventSource = new EventSourcePlus(formElement.action, {
    method: formElement.method || "GET",
    body: new FormData(formElement),
    withCredentials: true,
    retryStrategy: "on-error",
  });
  const controller = eventSource.listen({
    onRequest() {
      formElement
        .querySelectorAll('button[type="submit"]')
        .forEach((button) => {
          button.disabled = true;
        });
    },
    onMessage(message) {
      htmx.swap(target, message.data, { swapStyle: "innerHTML" });
      if (message.event === "close") {
        controller.abort();
        formElement
          .querySelectorAll('button[type="submit"]')
          .forEach((button) => {
            button.disabled = false;
          });
      }
    },
    onResponse({ response }) {
      if (response.status === 422) {
        controller.abort();
        return;
      }
    },
  });
};

window.formPostSSE = formPostSSE;
