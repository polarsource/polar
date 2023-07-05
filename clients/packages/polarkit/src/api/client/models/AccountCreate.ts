/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { AccountType } from './AccountType';

export type AccountCreate = {
  account_type: AccountType;
  open_collective_slug?: string;
  country: string;
};

