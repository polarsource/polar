import { spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

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
