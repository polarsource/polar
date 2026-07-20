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

export const validateWebhook = async <Payload>(
  body: string | Uint8Array,
  headers: Record<string, string>,
  secret: string,
  eventTypes: ReadonlySet<string>,
): Promise<Payload> => {
  const bodyText = typeof body === "string" ? body : new TextDecoder().decode(body);
  await verifySignature(bodyText, headers, secret);

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

const verifySignature = async (
  body: string,
  headers: Record<string, string>,
  secret: string,
): Promise<void> => {
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
  const textEncoder = new TextEncoder();
  const signedContentBytes = textEncoder.encode(signedContent);
  const signingKey = await globalThis.crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  for (const versionedSignature of webhookSignature.split(" ")) {
    const [version, signature] = versionedSignature.split(",", 2);
    if (version !== "v1" || signature === undefined) {
      continue;
    }
    const decodedSignature = decodeBase64(signature);
    if (
      decodedSignature !== null &&
      (await globalThis.crypto.subtle.verify(
        "HMAC",
        signingKey,
        decodedSignature,
        signedContentBytes,
      ))
    ) {
      return;
    }
  }

  throw new PolarWebhookVerificationError("No matching signature found");
};

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> | null => {
  try {
    const decodedValue = globalThis.atob(value);
    const bytes = new Uint8Array(new ArrayBuffer(decodedValue.length));
    for (let index = 0; index < decodedValue.length; index++) {
      bytes[index] = decodedValue.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
};
