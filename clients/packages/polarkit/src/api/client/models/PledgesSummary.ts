/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Funding } from './Funding';
import type { SummaryPledge } from './SummaryPledge';

export type PledgesSummary = {
  funding: Funding;
  pledges: Array<SummaryPledge>;
};

