import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

import { PolarError } from "./base";

const webhookToleranceSeconds = 5 * 60;

export class PolarWebhookError extends PolarError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PolarWebhookError";
  }
}

export class PolarWebhookVerificationError extends PolarWebhookError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PolarWebhookVerificationError";
  }
}

export class PolarWebhookUnknownTypeError extends PolarWebhookError {
  constructor(public readonly eventType: string | null) {
    super(`Unknown webhook event type: ${JSON.stringify(eventType)}`);
    this.name = "PolarWebhookUnknownTypeError";
  }
}

export const validateWebhook = <Payload>(
  body: string | Buffer,
  headers: Record<string, string>,
  secret: string,
  eventTypes: ReadonlySet<string>,
): Payload => {
  const bodyText = body.toString();
  verifySignature(bodyText, headers, secret);

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch (error) {
    throw new PolarWebhookError("Failed to parse webhook payload", {
      cause: error,
    });
  }

  const eventType =
    typeof parsed === "object" &&
    parsed !== null &&
    "type" in parsed &&
    typeof parsed.type === "string"
      ? parsed.type
      : null;
  if (eventType === null || !eventTypes.has(eventType)) {
    throw new PolarWebhookUnknownTypeError(eventType);
  }

  return parsed as Payload;
};

const verifySignature = (body: string, headers: Record<string, string>, secret: string): void => {
  if (secret.length === 0) {
    throw new PolarWebhookVerificationError("Secret can't be empty");
  }

  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const webhookId = normalizedHeaders["webhook-id"];
  const webhookTimestamp = normalizedHeaders["webhook-timestamp"];
  const webhookSignature = normalizedHeaders["webhook-signature"];
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new PolarWebhookVerificationError("Missing required headers");
  }

  const timestamp = Number(webhookTimestamp);
  if (!Number.isFinite(timestamp)) {
    throw new PolarWebhookVerificationError("Invalid signature headers");
  }

  const now = Date.now() / 1000;
  if (timestamp < now - webhookToleranceSeconds) {
    throw new PolarWebhookVerificationError("Message timestamp too old");
  }
  if (timestamp > now + webhookToleranceSeconds) {
    throw new PolarWebhookVerificationError("Message timestamp too new");
  }

  const signedContent = `${webhookId}.${Math.floor(timestamp)}.${body}`;
  const expectedSignature = createHmac("sha256", secret).update(signedContent).digest();

  for (const versionedSignature of webhookSignature.split(" ")) {
    const [version, signature] = versionedSignature.split(",", 2);
    if (version !== "v1" || signature === undefined) {
      continue;
    }
    const decodedSignature = Buffer.from(signature, "base64");
    if (
      decodedSignature.length === expectedSignature.length &&
      timingSafeEqual(expectedSignature, decodedSignature)
    ) {
      return;
    }
  }

  throw new PolarWebhookVerificationError("No matching signature found");
};
