import { describe, expect, it } from "vitest";
{% for version in ir.versions %}import * as {{ ("v" ~ version.version) | replace("-", "_") }} from "./{{ version.version }}/zod";
{% endfor %}

interface ParseableSchema {
  "~standard": { vendor: string };
  safeParse(input: unknown): unknown;
}

const schemaModules: Record<string, Record<string, ParseableSchema>> = {
{% for version in ir.versions %}  "{{ version.version }}": {{ ("v" ~ version.version) | replace("-", "_") }},
{% endfor %}};

{% set latest = ir.versions[-1].version %}
const { WebhookPayload } = {{ ("v" ~ latest) | replace("-", "_") }};

const customerDeletedPayload = {
  type: "customer.deleted",
  timestamp: "2026-01-01T00:00:00Z",
  api_version: "{{ latest }}",
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

describe("{{ latest }} WebhookPayload", () => {
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
