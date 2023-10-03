/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CurrencyAmount } from './CurrencyAmount';
import type { Issue } from './Issue';
import type { PledgesTypeSummaries } from './PledgesTypeSummaries';

export type IssueFunding = {
  issue: Issue;
  funding_goal?: CurrencyAmount;
  total: CurrencyAmount;
  pledges_summaries: PledgesTypeSummaries;
};

