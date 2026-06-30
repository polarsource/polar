import { ClientBase, ClientOptions } from "./base";
import { createOrganizationsService } from "./services/organizations";
import { createSubscriptionsService } from "./services/subscriptions";
import { createOauth2Service } from "./services/oauth2";
import { createBenefitsService } from "./services/benefits";
import { createBenefitGrantsService } from "./services/benefit_grants";
import { createWebhooksService } from "./services/webhooks";
import { createProductsService } from "./services/products";
import { createOrdersService } from "./services/orders";
import { createRefundsService } from "./services/refunds";
import { createDisputesService } from "./services/disputes";
import { createCheckoutsService } from "./services/checkouts";
import { createFilesService } from "./services/files";
import { createMetricsService } from "./services/metrics";
import { createLicenseKeysService } from "./services/license_keys";
import { createCheckoutLinksService } from "./services/checkout_links";
import { createCustomFieldsService } from "./services/custom_fields";
import { createDiscountsService } from "./services/discounts";
import { createCustomersService } from "./services/customers";
import { createMembersService } from "./services/members";
import { createCustomerPortalService } from "./services/customer_portal";
import { createCustomerSeatsService } from "./services/customer_seats";
import { createCustomerSessionsService } from "./services/customer_sessions";
import { createEventsService } from "./services/events";
import { createEventTypesService } from "./services/event_types";
import { createMetersService } from "./services/meters";
import { createCustomerMetersService } from "./services/customer_meters";
import { createPaymentsService } from "./services/payments";

export interface PolarOptions extends ClientOptions {}

export function createPolar(options: PolarOptions) {
  const client = new ClientBase(options);

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
