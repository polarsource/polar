import htmx from "htmx.org";
import _hyperscript from "hyperscript.org";
import { EventSourcePlus } from "event-source-plus";

window.htmx = htmx;
_hyperscript.browserInit();

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
