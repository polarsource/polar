import { ClientBase, ClientOptions, resolveBaseUrl } from "../base";
import { PolarEventClient, type PolarEventOptions } from "../metering/client";
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

export interface PolarOptions
  extends Omit<ClientOptions, "baseUrl" | "version">, PolarEventOptions {
  environment?: Environment;
  baseUrl?: string;
}

export function createPolarCore(options: PolarOptions) {
  return new ClientBase({
    ...options,
    baseUrl: resolveBaseUrl(SERVERS, options.environment ?? "production", options.baseUrl),
    version: "2026-04",
  });
}

export type PolarCore = ReturnType<typeof createPolarCore>;

export function createPolar(options: PolarOptions) {
  const client = createPolarCore(options);
  const events = new PolarEventClient(client, options);

  const services = {
    events: createEventsService(client),
    customerPortal: createCustomerPortalService(client),
    customers: createCustomersService(client),
    checkouts: createCheckoutsService(client),
    subscriptions: createSubscriptionsService(client),
    products: createProductsService(client),
    licenseKeys: createLicenseKeysService(client),
    orders: createOrdersService(client),
    organizations: createOrganizationsService(client),
    customerMeters: createCustomerMetersService(client),
    metrics: createMetricsService(client),
    discounts: createDiscountsService(client),
    oauth2: createOauth2Service(client),
    meters: createMetersService(client),
    benefits: createBenefitsService(client),
    payments: createPaymentsService(client),
    disputes: createDisputesService(client),
    refunds: createRefundsService(client),
    webhooks: createWebhooksService(client),
    benefitGrants: createBenefitGrantsService(client),
    checkoutLinks: createCheckoutLinksService(client),
    customerSessions: createCustomerSessionsService(client),
    files: createFilesService(client),
    customerSeats: createCustomerSeatsService(client),
    customFields: createCustomFieldsService(client),
    eventTypes: createEventTypesService(client),
  };

  return {
    ...services,
    actor: events.actor.bind(events),
    track: events.track.bind(events),
    meter: events.meter.bind(events),
    flush: events.flush.bind(events),
    close: events.close.bind(events),
  };
}

export type Polar = ReturnType<typeof createPolar>;
