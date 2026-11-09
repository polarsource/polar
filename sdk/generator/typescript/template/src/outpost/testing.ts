import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

import type { Reducer } from "./reducer";

import { ClientBase } from "../base";

export interface RedisServer {
  socket: string;
  stop(): Promise<void>;
}

// A throwaway redis-server on a Unix socket, for the tests and benchmarks.
export const startRedisServer = async (): Promise<RedisServer> => {
  const directory = await mkdtemp(join(tmpdir(), "polar-outpost-"));
  const socket = join(directory, "redis.sock");
  const server = spawn(
    "redis-server",
    ["--port", "0", "--unixsocket", socket, "--save", "", "--appendonly", "no"],
    { stdio: "ignore" },
  );
  let startupError: Error | undefined;
  server.on("error", (error) => {
    startupError = error;
  });
  await vi.waitFor(async () => {
    if (startupError) throw startupError;
    await access(socket);
  });
  return {
    socket,
    async stop() {
      if (server.exitCode === null && server.signalCode === null) {
        const exited = once(server, "exit");
        server.kill();
        await exited;
      }
      await rm(directory, { recursive: true, force: true });
    },
  };
};

export interface PolarServer {
  client: ClientBase;
  stop(): Promise<void>;
}

// Polar's side of Outpost: the configuration, the snapshot when given one, no changes, and a
// sink for telemetry exports.
export const startPolarServer = async (
  reducers: Reducer[],
  snapshot?: Record<string, unknown>,
): Promise<PolarServer> => {
  let cursor = 0;
  const server = createServer(async (request, response) => {
    let data = "";
    for await (const chunk of request) data += chunk;
    const url = new URL(request.url!, "http://polar");
    const body = (value: unknown) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(value));
    };
    if (url.pathname === "/v1/outpost/configuration")
      return body({ organization_id: "org", reducers });
    if (url.pathname === "/v1/outpost/meter-usage")
      return body(snapshot ? [{ customer_exists: true, ...snapshot, ...JSON.parse(data) }] : []);
    if (url.pathname === "/v1/outpost/changes")
      return body({
        changes: [],
        cursor: `${++cursor}-0`,
        has_more: false,
        reset: false,
        configuration_changed: false,
        next_poll_in: 30,
      });
    if (url.pathname.startsWith("/v1/outpost/telemetry")) return response.writeHead(200).end();
    response.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (typeof address === "string" || !address) throw new Error("Missing server address");
  return {
    client: new ClientBase({
      baseUrl: `http://127.0.0.1:${address.port}`,
      accessToken: "bench-token",
      version: "2026-10",
      organizationId: "org",
    }),
    async stop() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};
