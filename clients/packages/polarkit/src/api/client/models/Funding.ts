/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CurrencyAmount } from './CurrencyAmount';

export type Funding = {
  funding_goal?: CurrencyAmount;
  /**
   * Sum of pledges to this isuse (including currently open pledges and pledges that have been paid out). Always in USD.
   */
  pledges_sum?: CurrencyAmount;
};

