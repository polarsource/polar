---
'@polar-sh/cli': patch
---

Report failed API requests accurately. A server error now shows its status and the server's message instead of blaming the network, a timeout says it timed out and after how long, and only a real connection failure asks you to check your connection, naming the host it couldn't reach. `--json` errors include the HTTP `status`, and `--log-level debug` logs the failed response to stderr.
