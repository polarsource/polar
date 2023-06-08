/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AccountType } from './AccountType';

export type AccountRead = {
  account_type?: AccountType;
  country: string;
  stripe_id: string;
  balance?: number;
  balance_currency?: string;
  is_details_submitted?: boolean;
  is_admin?: boolean;
};

