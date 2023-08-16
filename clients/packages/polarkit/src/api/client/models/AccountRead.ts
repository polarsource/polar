/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AccountType } from './AccountType';

export type AccountRead = {
  user_id?: string;
  organization_id?: string;
  account_type: AccountType;
  open_collective_slug?: string;
  /**
   * Two letter uppercase country code
   */
  country: string;
  id: string;
  stripe_id?: string;
  balance?: number;
  balance_currency?: string;
  is_details_submitted?: boolean;
  is_admin?: boolean;
};

