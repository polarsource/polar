/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Pledger } from './Pledger';
import type { PledgeType } from './PledgeType';

export type SummaryPledge = {
  /**
   * Type of pledge
   */
  type: PledgeType;
  pledger: Pledger;
};

