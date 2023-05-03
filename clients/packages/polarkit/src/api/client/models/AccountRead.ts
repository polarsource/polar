/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AccountType } from './AccountType';

export type AccountRead = {
  account_type?: AccountType;
  country: string;
  stripe_id: string;
  balance?: number;
  is_details_submitted?: boolean;
  is_admin?: boolean;
};

