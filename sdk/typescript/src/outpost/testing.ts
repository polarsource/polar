import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import { WebSocketServer } from "ws";

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

// Polar's side of the WebSocket: the configuration, and the snapshot when given one.
export const startPolarServer = async (
  reducers: Reducer[],
  snapshot?: Record<string, unknown>,
): Promise<PolarServer> => {
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1", path: "/v1/outpost/" });
  await once(server, "listening");
  server.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "connection", payload: { id: "bench" } }));
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "configuration")
        ws.send(JSON.stringify({ type: "configuration", payload: { reducers } }));
      if (message.type === "meter_usage" && snapshot) {
        const payload = { customer_exists: true, ...snapshot, ...message.payload };
        ws.send(JSON.stringify({ type: "meter_usage", payload }));
      }
    });
  });
  const address = server.address();
  if (typeof address === "string" || !address) throw new Error("Missing WebSocket address");
  return {
    client: new ClientBase({
      baseUrl: `http://127.0.0.1:${address.port}`,
      accessToken: "bench-token",
      version: "2026-10",
      organizationId: "org",
    }),
    async stop() {
      for (const ws of server.clients) ws.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};
