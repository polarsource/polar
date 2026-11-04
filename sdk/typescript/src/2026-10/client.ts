import { ClientBase, ClientOptions, resolveBaseUrl } from "../base";
import { createMetering, type Metering, type MeteringOptions } from "../metering/client";
import { createBenefitGrantsService, type BenefitGrants } from "./services/benefit_grants";
import { createBenefitsService, type Benefits } from "./services/benefits";
import { createCheckoutLinksService, type CheckoutLinks } from "./services/checkout_links";
import { createCheckoutsService, type Checkouts } from "./services/checkouts";
import { createCustomFieldsService, type CustomFields } from "./services/custom_fields";
import { createCustomerMetersService, type CustomerMeters } from "./services/customer_meters";
import { createCustomerPortalService, type CustomerPortal } from "./services/customer_portal";
import { createCustomerSeatsService, type CustomerSeats } from "./services/customer_seats";
import { createCustomerSessionsService, type CustomerSessions } from "./services/customer_sessions";
import { createCustomersService, type Customers } from "./services/customers";
import { createDiscountsService, type Discounts } from "./services/discounts";
import { createDisputesService, type Disputes } from "./services/disputes";
import { createEventTypesService, type EventTypes } from "./services/event_types";
import { createEventsService, type Events } from "./services/events";
import { createFilesService, type Files } from "./services/files";
import { createLicenseKeysService, type LicenseKeys } from "./services/license_keys";
import { createMetersService, type Meters } from "./services/meters";
import { createMetricsService, type Metrics } from "./services/metrics";
import { createOauth2Service, type Oauth2 } from "./services/oauth2";
import { createOrdersService, type Orders } from "./services/orders";
import { createOrganizationsService, type Organizations } from "./services/organizations";
import { createPaymentsService, type Payments } from "./services/payments";
import { createProductsService, type Products } from "./services/products";
import { createRefundsService, type Refunds } from "./services/refunds";
import { createSubscriptionsService, type Subscriptions } from "./services/subscriptions";
import { createWebhooksService, type Webhooks } from "./services/webhooks";

export type Environment = "production" | "sandbox";

const SERVERS: Record<Environment, string> = {
  production: "https://api.polar.sh",
  sandbox: "https://sandbox-api.polar.sh",
};

export interface PolarOptions extends Omit<ClientOptions, "baseUrl" | "version"> {
  environment?: Environment;
  baseUrl?: string;
}

export function createPolarCore(options: PolarOptions) {
  return new ClientBase({
    ...options,
    baseUrl: resolveBaseUrl(SERVERS, options.environment ?? "production", options.baseUrl),
    version: "2026-10",
  });
}

export type PolarCore = ReturnType<typeof createPolarCore>;

export interface Polar {
  organizations: Organizations;
  subscriptions: Subscriptions;
  oauth2: Oauth2;
  benefits: Benefits;
  benefitGrants: BenefitGrants;
  webhooks: Webhooks;
  products: Products;
  orders: Orders;
  refunds: Refunds;
  disputes: Disputes;
  checkouts: Checkouts;
  files: Files;
  metrics: Metrics;
  licenseKeys: LicenseKeys;
  checkoutLinks: CheckoutLinks;
  customFields: CustomFields;
  discounts: Discounts;
  customers: Customers;
  customerPortal: CustomerPortal;
  customerSeats: CustomerSeats;
  customerSessions: CustomerSessions;
  events: Events;
  eventTypes: EventTypes;
  meters: Meters;
  customerMeters: CustomerMeters;
  payments: Payments;
  /**
   * Create a helper for buffered event delivery and customer meter reads.
   *
   * @param options.buffered Batch and retry options; defaults to 100 events, a 1000-ms
   * collection interval, a 5000-ms shutdown timeout, and 3 attempts.
   * @param options.outpost true or Outpost options to enable Outpost. Disabled by default.
   * Pass false to disable; explicit options require a Redis URL.
   * @param options.strategies Replace all defaults with custom strategies. Cannot be
   * combined with buffered or outpost.
   * @returns A metering helper that starts on its first operation.
   */
  metering: (options?: MeteringOptions) => Metering;
}

export function createPolar(options: PolarOptions): Polar {
  const client = createPolarCore(options);

  const services = {
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
    customerPortal: createCustomerPortalService(client),
    customerSeats: createCustomerSeatsService(client),
    customerSessions: createCustomerSessionsService(client),
    events: createEventsService(client),
    eventTypes: createEventTypesService(client),
    meters: createMetersService(client),
    customerMeters: createCustomerMetersService(client),
    payments: createPaymentsService(client),
  };

  return {
    ...services,
    metering: (options?: MeteringOptions) => createMetering(services, client, options),
  };
}
