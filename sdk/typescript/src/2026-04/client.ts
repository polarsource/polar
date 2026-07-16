import { ClientBase, ClientOptions, resolveBaseUrl } from "../base";
import { createBenefitGrantsService } from "./services/benefit_grants";
import { createBenefitsService } from "./services/benefits";
import { createCheckoutLinksService } from "./services/checkout_links";
import { createCheckoutsService } from "./services/checkouts";
import { createCustomFieldsService } from "./services/custom_fields";
import { createCustomerMetersService } from "./services/customer_meters";
import { createCustomerPortalService } from "./services/customer_portal";
import { createCustomerSeatsService } from "./services/customer_seats";
import { createCustomerSessionsService } from "./services/customer_sessions";
import { createCustomersService } from "./services/customers";
import { createDiscountsService } from "./services/discounts";
import { createDisputesService } from "./services/disputes";
import { createEventTypesService } from "./services/event_types";
import { createEventsService } from "./services/events";
import { createFilesService } from "./services/files";
import { createLicenseKeysService } from "./services/license_keys";
import { createMembersService } from "./services/members";
import { createMetersService } from "./services/meters";
import { createMetricsService } from "./services/metrics";
import { createOauth2Service } from "./services/oauth2";
import { createOrdersService } from "./services/orders";
import { createOrganizationsService } from "./services/organizations";
import { createPaymentsService } from "./services/payments";
import { createProductsService } from "./services/products";
import { createRefundsService } from "./services/refunds";
import { createSubscriptionsService } from "./services/subscriptions";
import { createWebhooksService } from "./services/webhooks";

export type Environment = "production" | "sandbox";

const SERVERS: Record<Environment, string> = {
  production: "https://api.polar.sh",
  sandbox: "https://sandbox-api.polar.sh",
};

export interface PolarOptions extends Omit<ClientOptions, "baseUrl" | "version"> {
  version?: string;
  environment?: Environment;
  baseUrl?: string;
}

export function createPolarCore(options: PolarOptions) {
  return new ClientBase({
    ...options,
    baseUrl: resolveBaseUrl(SERVERS, options.environment ?? "production", options.baseUrl),
    version: options.version ?? "2026-04",
  });
}

export type PolarCore = ReturnType<typeof createPolarCore>;

export function createPolar(options: PolarOptions) {
  const client = createPolarCore(options);

  return {
    organizations: createOrganizationsService(client),
    subscriptions: createSubscriptionsService(client),
    oauth2: createOauth2Service(client),
    benefits: createBenefitsService(client),
    benefitGrants: createBenefitGrantsService(client),
    webhooks: createWebhooksService(client),
    products: createProductsService(client),
    orders: createOrdersService(client),
    refunds: createRefundsService(client),
    disputes: createDisputesService(client),
    checkouts: createCheckoutsService(client),
    files: createFilesService(client),
    metrics: createMetricsService(client),
    licenseKeys: createLicenseKeysService(client),
    checkoutLinks: createCheckoutLinksService(client),
    customFields: createCustomFieldsService(client),
    discounts: createDiscountsService(client),
    customers: createCustomersService(client),
    members: createMembersService(client),
    customerPortal: createCustomerPortalService(client),
    customerSeats: createCustomerSeatsService(client),
    customerSessions: createCustomerSessionsService(client),
    events: createEventsService(client),
    eventTypes: createEventTypesService(client),
    meters: createMetersService(client),
    customerMeters: createCustomerMetersService(client),
    payments: createPaymentsService(client),
  };
}

export type Polar = ReturnType<typeof createPolar>;
