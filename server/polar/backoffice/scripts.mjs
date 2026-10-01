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

let pendingContentRequest = null;

// Latest navigation wins, like a full page load. Completion is tracked on the
// XHR because htmx:afterRequest doesn't bubble once a swap detaches the link.
// Uses htmx's request class so history snapshots don't keep the loading state.
document.addEventListener("htmx:beforeSend", (event) => {
  const { target, elt, xhr } = event.detail;
  if (!target || target.id !== "content") {
    return;
  }
  pendingContentRequest?.abort();
  pendingContentRequest = xhr;
  target.classList.add(htmx.config.requestClass);
  xhr.addEventListener("loadend", () => {
    if (pendingContentRequest === xhr) {
      pendingContentRequest = null;
      target.classList.remove(htmx.config.requestClass);
    }
  });
  if (elt.closest(".drawer-side")) {
    document.getElementById("menu-toggle").checked = false;
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
