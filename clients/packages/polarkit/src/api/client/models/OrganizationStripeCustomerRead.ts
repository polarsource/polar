/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { PaymentMethod } from './PaymentMethod';

export type OrganizationStripeCustomerRead = {
  email?: string;
  addressCity?: string;
  addressCountry?: string;
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  state?: string;
  default_payment_method?: PaymentMethod;
};

