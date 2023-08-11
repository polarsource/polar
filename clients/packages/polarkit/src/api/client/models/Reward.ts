/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CurrencyAmount } from './CurrencyAmount';
import type { Organization } from './Organization';
import type { Pledge } from './Pledge';
import type { RewardState } from './RewardState';
import type { User } from './User';

export type Reward = {
  pledge: Pledge;
  user?: User;
  organization?: Organization;
  amount: CurrencyAmount;
  state: RewardState;
};

