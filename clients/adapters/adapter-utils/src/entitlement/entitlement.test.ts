import { describe, it, expect, vi } from "vitest";
import type { Benefit } from "@polar-sh/sdk/models/components/benefit";
import type { WebhookBenefitGrantCreatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantcreatedpayload";
import type { WebhookBenefitGrantRevokedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantrevokedpayload";
import { EntitlementStrategy } from "./entitlement";

describe("EntitlementStrategy", () => {
  it("should run grant on handler", () => {
    const onGrant = vi.fn();
    const onRevoke = vi.fn();

    const entitlement = new EntitlementStrategy<{ test: string }>().grant(
      onGrant,
    );

    expect(entitlement).toBeDefined();

    const payload = {
      type: "benefit_grant.created",
      timestamp: new Date(),
      data: {
        id: "123",
        createdAt: new Date(),
        modifiedAt: new Date(),
        isGranted: true,
        benefitId: "123",
        customerId: "123",
        subscriptionId: "123",
        orderId: "123",
        userId: "123",
        isRevoked: false,
        properties: { test: "test" },
        customer: {
          email: "test@test.com",
          id: "123",
          createdAt: new Date(),
          modifiedAt: new Date(),
          deletedAt: null,
          metadata: {},
          emailVerified: true,
          billingAddress: {
            line1: "123",
            line2: "123",
            city: "123",
            state: "123",
            postalCode: "123",
            country: "US",
          },
          name: "Test",
          taxId: ["123"],
          organizationId: "123",
          avatarUrl: "123",
        },
        benefit: {
          id: "123",
          createdAt: new Date(),
          modifiedAt: new Date(),
          selectable: true,
          description: "test",
        } as unknown as Benefit,
      },
    } as WebhookBenefitGrantCreatedPayload;

    entitlement.handler("test")(payload);

    expect(onGrant).toHaveBeenCalledWith({
      payload,
      customer: payload.data.customer,
      properties: payload.data.properties,
    });

    expect(onRevoke).not.toHaveBeenCalled();
  });

  it("should run revoke on handler", () => {
    const onGrant = vi.fn();
    const onRevoke = vi.fn();

    const entitlement = new EntitlementStrategy<{ test: string }>()
      .grant(onGrant)
      .revoke(onRevoke);

    const payload = {
      type: "benefit_grant.revoked",
      timestamp: new Date(),
      data: {
        id: "123",
        createdAt: new Date(),
        modifiedAt: new Date(),
        isGranted: false,
        benefitId: "123",
        customerId: "123",
        benefit: { description: "test" },
      },
    } as WebhookBenefitGrantRevokedPayload;

    entitlement.handler("test")(payload);

    expect(onGrant).not.toHaveBeenCalled();

    expect(onRevoke).toHaveBeenCalledWith({
      payload,
      customer: payload.data.customer,
      properties: payload.data.properties,
    });
  });
});
