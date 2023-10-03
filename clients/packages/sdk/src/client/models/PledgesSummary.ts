/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CurrencyAmount } from './CurrencyAmount';
import type { Pledger } from './Pledger';

export type PledgesSummary = {
  total: CurrencyAmount;
  pledgers: Array<Pledger>;
};

