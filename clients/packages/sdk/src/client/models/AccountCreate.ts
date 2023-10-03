/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AccountType } from './AccountType';

export type AccountCreate = {
  user_id?: string;
  organization_id?: string;
  account_type: AccountType;
  open_collective_slug?: string;
  /**
   * Two letter uppercase country code
   */
  country: string;
};

