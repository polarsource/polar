import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { bench, describe } from "vitest";

import type { ListResourceCustomer } from "./{{ version }}/models";

import { createPolar, createPolarCore } from "./{{ version }}";
import data from "./customers.benchmark.json";

const accessToken = "benchmark";

function customerPage(count: number): Uint8Array<ArrayBuffer> {
  const items = Array.from({ length: count }, (_, index) => ({
    ...data.customer,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    external_id: `customer-${index + 1}`,
    email: `customer-${index + 1}@example.com`,
  }));
  return new TextEncoder().encode(
    JSON.stringify({ items, pagination: { total_count: count, max_page: 1 } }),
  );
}

describe("customer requests", () => {
  let polar: ReturnType<typeof createPolar>;
  let server: ReturnType<typeof spawn> | undefined;
  const requestBatch = () =>
    Promise.all(Array.from({ length: data.concurrency }, () => polar.customers.list({ limit: 1 })));

  bench(
    `${data.concurrency} concurrent customer requests`,
    async () => {
      await requestBatch();
    },
    {
      async setup() {
        const child = spawn("node", ["customer-server.mjs", "customers.benchmark.json"], {
          cwd: fileURLToPath(new URL(".", import.meta.url)),
          stdio: ["ignore", "pipe", "inherit"],
        });
        server = child;
        const output = createInterface({ input: child.stdout });
        try {
          const [baseUrl] = await Promise.race([
            once(output, "line"),
            once(child, "exit").then(() => {
              throw new Error("HTTP server did not start");
            }),
          ]);
          assert(baseUrl.startsWith("http://127.0.0.1:"));
          polar = createPolar({ accessToken, baseUrl });
          const pages = await requestBatch();
          assert(pages.every((page) => page.items[0]?.id === data.customer.id));
        } catch (error) {
          child.kill();
          throw error;
        } finally {
          output.close();
        }
      },
      teardown() {
        server?.kill();
      },
    },
  );
});

describe("customer response decoding", () => {
  const client = createPolarCore({ accessToken });
  const body = customerPage(data.page_size);
  const decode = () => client.parseResponse<ListResourceCustomer>(new Response(body), "json");

  bench(
    `decode a ${data.page_size}-customer page (${body.byteLength} bytes)`,
    async () => {
      await decode();
    },
    {
      async setup() {
        const page = await decode();
        assert.equal(page.items.length, data.page_size);
        assert.equal(page.items.at(-1)?.external_id, `customer-${data.page_size}`);
      },
    },
  );
});
