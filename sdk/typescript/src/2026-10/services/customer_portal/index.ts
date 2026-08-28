import type { ClientBase } from "../../../base";

import { createBenefitGrantsService } from "./benefit_grants";
import { createCustomerMetersService } from "./customer_meters";
import { createCustomerSessionService } from "./customer_session";
import { createCustomersService } from "./customers";
import { createDownloadablesService } from "./downloadables";
import { createLicenseKeysService } from "./license_keys";
import { createMembersService } from "./members";
import { createOrdersService } from "./orders";
import { createOrganizationsService } from "./organizations";
import { createSeatsService } from "./seats";
import { createSubscriptionsService } from "./subscriptions";
import { createWalletsService } from "./wallets";

export function createCustomerPortalService(client: ClientBase) {
  return {
    benefitGrants: createBenefitGrantsService(client),
    customers: createCustomersService(client),
    customerMeters: createCustomerMetersService(client),
    seats: createSeatsService(client),
    customerSession: createCustomerSessionService(client),
    downloadables: createDownloadablesService(client),
    licenseKeys: createLicenseKeysService(client),
    members: createMembersService(client),
    orders: createOrdersService(client),
    organizations: createOrganizationsService(client),
    subscriptions: createSubscriptionsService(client),
    wallets: createWalletsService(client),
  };
}

export type CustomerPortal = ReturnType<typeof createCustomerPortalService>;
