import { describe, expect, it } from "vitest";

import * as v2026_04 from "./2026-04/zod";
import * as v2026_10 from "./2026-10/zod";
import * as v2027_01 from "./2027-01/zod";

interface ParseableSchema {
  "~standard": { vendor: string };
  safeParse(input: unknown): unknown;
}

const schemaModules: Record<string, Record<string, ParseableSchema>> = {
  "2026-04": v2026_04,
  "2026-10": v2026_10,
  "2027-01": v2027_01,
};

const { WebhookPayload } = v2027_01;

const customerDeletedPayload = {
  type: "customer.deleted",
  timestamp: "2026-01-01T00:00:00Z",
  api_version: "2027-01",
  data: {
    id: "00000000-0000-4000-8000-000000000000",
    created_at: "2026-01-01T00:00:00Z",
    modified_at: null,
    metadata: { plan: "pro", seats: 3 },
    email: "customer@example.com",
    email_verified: true,
    type: "individual",
    name: null,
    billing_name: null,
    billing_address: null,
    tax_id: null,
    organization_id: "00000000-0000-4000-8000-000000000001",
    deleted_at: "2026-01-02T00:00:00Z",
    first_user_event_at: null,
    avatar_url: null,
  },
};

describe.each(Object.entries(schemaModules))("%s", (_, schemas) => {
  it.each(Object.entries(schemas))("initializes %s", (_, schema) => {
    expect(schema["~standard"].vendor).toBe("zod");
    expect(() => schema.safeParse({})).not.toThrow();
  });
});

describe("2027-01 WebhookPayload", () => {
  it("accepts a valid payload and keeps unknown fields", () => {
    const payload = {
      ...customerDeletedPayload,
      data: { ...customerDeletedPayload.data, added_later: "value" },
    };

    const result = WebhookPayload.parse(payload);

    expect(result.type).toBe("customer.deleted");
    expect(result.data).toMatchObject({ added_later: "value" });
  });

  it("reports the path of an invalid field", () => {
    const payload = {
      ...customerDeletedPayload,
      data: { ...customerDeletedPayload.data, email_verified: "yes" },
    };

    const result = WebhookPayload.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["data", "email_verified"]);
  });

  it("rejects an unknown event type", () => {
    const result = WebhookPayload.safeParse({
      ...customerDeletedPayload,
      type: "unknown.event",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("invalid_union");
  });
});
