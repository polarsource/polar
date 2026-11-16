import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const { customer } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const body = JSON.stringify({ items: [customer], pagination: { total_count: 1, max_page: 1 } });

const server = createServer((request, response) => {
  if (request.method !== "GET" || !request.url?.startsWith("/v1/customers/?")) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
});

server.listen(0, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${server.address().port}`);
});
