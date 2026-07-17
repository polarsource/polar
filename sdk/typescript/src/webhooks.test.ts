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

const getHeaders = (body: string, timestamp: Date = new Date()): Record<string, string> => {
  const signature = new Webhook(base64Secret).sign("test-webhook", timestamp, body);
  return {
    "Webhook-Id": "test-webhook",
    "Webhook-Timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "Webhook-Signature": signature,
  };
};

const validateEvent = (body: string | Buffer, headers: Record<string, string>): DummyPayload => {
  return validateWebhook<DummyPayload>(body, headers, secret, eventTypes);
};

describe("validateWebhook", () => {
  test.each([false, true])("validates a known event (buffer: %s)", (asBuffer) => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });
    const rawBody = asBuffer ? Buffer.from(body) : body;

    expect(validateEvent(rawBody, getHeaders(body))).toEqual({
      type: "dummy.event",
      value: "payload",
    });
  });

  test("rejects an invalid signature", () => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });

    expect(() => validateEvent(body, getHeaders("{}"))).toThrow(PolarWebhookVerificationError);
  });

  test("rejects missing headers", () => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });

    expect(() => validateEvent(body, {})).toThrow(PolarWebhookVerificationError);
  });

  test("rejects a stale timestamp", () => {
    const body = JSON.stringify({ type: "dummy.event", value: "payload" });
    const timestamp = new Date(Date.now() - 6 * 60 * 1000);

    expect(() => validateEvent(body, getHeaders(body, timestamp))).toThrow(
      PolarWebhookVerificationError,
    );
  });

  test("rejects an unknown event type", () => {
    const body = JSON.stringify({ type: "future.event", value: "payload" });

    try {
      validateEvent(body, getHeaders(body));
      throw new Error("Expected validateEvent to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PolarWebhookUnknownTypeError);
      expect((error as PolarWebhookUnknownTypeError).eventType).toBe("future.event");
    }
  });

  test("wraps malformed signed payloads", () => {
    const body = "{";

    expect(() => validateEvent(body, getHeaders(body))).toThrow(PolarWebhookError);
  });

  test("uses the Polar webhook error hierarchy", () => {
    expect(new PolarWebhookError("error")).toBeInstanceOf(PolarError);
    expect(new PolarWebhookVerificationError("error")).toBeInstanceOf(PolarWebhookError);
    expect(new PolarWebhookUnknownTypeError("future.event")).toBeInstanceOf(PolarWebhookError);
  });
});
