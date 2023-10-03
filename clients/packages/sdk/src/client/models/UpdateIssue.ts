/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CurrencyAmount } from './CurrencyAmount';

export type UpdateIssue = {
  funding_goal?: CurrencyAmount;
  upfront_split_to_contributors?: number;
  unset_upfront_split_to_contributors?: boolean;
};

