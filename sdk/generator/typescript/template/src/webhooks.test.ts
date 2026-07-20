import { Buffer } from "node:buffer";

import { Webhook } from "standardwebhooks";
import { describe, expect, test } from "vitest";

import { PolarError } from "./base";
import {
  PolarWebhookError,
  PolarWebhookUnknownTypeError,
  PolarWebhookVerificationError,
  validateWebhook,
} from "./webhooks";

interface DummyPayload {
  type: "dummy.event";
  value: string;
}

const secret = "test-secret";
const base64Secret = Buffer.from(secret, "utf8").toString("base64");
const eventTypes = new Set(["dummy.event"]);

const getHeaders = (
  body: string,
  timestamp: Date = new Date(),
): Record<string, string> => {
  const signature = new Webhook(base64Secret).sign(
    "test-webhook",
    timestamp,
    body,
  );
  return {
    "Webhook-Id": "test-webhook",
    "Webhook-Timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "Webhook-Signature": signature,
  };
};

const validateEvent = (
  body: string | Uint8Array,
  headers: Record<string, string>,
): Promise<DummyPayload> => {
  return validateWebhook<DummyPayload>(body, headers, secret, eventTypes);
};

describe("validateWebhook", () => {
  test.each([
    ["string", (body: string) => body],
    ["Buffer", (body: string) => Buffer.from(body)],
    ["Uint8Array", (body: string) => new TextEncoder().encode(body)],
  ])("validates a known event from a %s", async (_type, getRawBody) => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });

    await expect(
      validateEvent(getRawBody(body), getHeaders(body)),
    ).resolves.toEqual({
      type: "dummy.event",
      value: "payload",
    });
  });

  test("rejects an invalid signature", async () => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });

    await expect(validateEvent(body, getHeaders("{}"))).rejects.toThrow(
      PolarWebhookVerificationError,
    );
  });

  test("rejects malformed signature encoding", async () => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });
    const headers = getHeaders(body);
    headers["Webhook-Signature"] = "v1,not-base64!";

    await expect(validateEvent(body, headers)).rejects.toThrow(
      PolarWebhookVerificationError,
    );
  });

  test("rejects missing headers", async () => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });

    await expect(validateEvent(body, {})).rejects.toThrow(
      PolarWebhookVerificationError,
    );
  });

  test("rejects a stale timestamp", async () => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });
    const timestamp = new Date(Date.now() - 6 * 60 * 1000);

    await expect(
      validateEvent(body, getHeaders(body, timestamp)),
    ).rejects.toThrow(
      PolarWebhookVerificationError,
    );
  });

  test("rejects an unknown event type", async () => {
    const body = JSON.stringify({ type: "future.event", value: "payload" });

    try {
      await validateEvent(body, getHeaders(body));
      throw new Error("Expected validateEvent to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PolarWebhookUnknownTypeError);
      expect((error as PolarWebhookUnknownTypeError).eventType).toBe(
        "future.event",
      );
    }
  });

  test("wraps malformed signed payloads", async () => {
    const body = "{";

    await expect(validateEvent(body, getHeaders(body))).rejects.toThrow(
      PolarWebhookError,
    );
  });

  test("uses the Polar webhook error hierarchy", () => {
    expect(new PolarWebhookError("error")).toBeInstanceOf(PolarError);
    expect(new PolarWebhookVerificationError("error")).toBeInstanceOf(
      PolarWebhookError,
    );
    expect(new PolarWebhookUnknownTypeError("future.event")).toBeInstanceOf(
      PolarWebhookError,
    );
  });
});
