import { afterAll, beforeAll, expect, it, vi } from "vitest";

import { startPolarServer, startRedisServer, type PolarServer, type RedisServer } from "./testing";

// As if the application installed none of the OpenTelemetry peer dependencies.
vi.mock("@opentelemetry/api", () => {
  throw new Error("@opentelemetry/api is not installed");
});
vi.mock("@opentelemetry/otlp-transformer", () => {
  throw new Error("@opentelemetry/otlp-transformer is not installed");
});
vi.mock("@opentelemetry/resources", () => {
  throw new Error("@opentelemetry/resources is not installed");
});
vi.mock("@opentelemetry/sdk-metrics", () => {
  throw new Error("@opentelemetry/sdk-metrics is not installed");
});
vi.mock("@opentelemetry/sdk-trace", () => {
  throw new Error("@opentelemetry/sdk-trace is not installed");
});

let redisServer: RedisServer;
let polar: PolarServer;

beforeAll(async () => {
  redisServer = await startRedisServer();
  polar = await startPolarServer([]);
});

afterAll(async () => {
  await polar?.stop();
  await redisServer?.stop();
});

it("runs without OpenTelemetry installed when telemetry is off", async () => {
  vi.stubEnv("POLAR_OUTPOST_TELEMETRY", "0");
  const { outpost } = await import("./index");
  const instance = outpost({ redis: redisServer.socket })(polar.client);
  await instance.start();
  try {
    await expect(
      instance.track({
        name: "api_request",
        external_customer_id: "customer_123",
        external_id: "req_42",
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  } finally {
    await instance.close();
  }
});
