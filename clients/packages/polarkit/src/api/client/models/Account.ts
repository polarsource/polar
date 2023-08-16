/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AccountType } from './AccountType';

export type Account = {
  id: string;
  account_type: AccountType;
  stripe_id?: string;
  open_collective_slug?: string;
  is_details_submitted?: boolean;
  country: string;
};

