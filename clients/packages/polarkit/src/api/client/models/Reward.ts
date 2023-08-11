/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Organization } from './Organization';
import type { Pledge } from './Pledge';
import type { RewardState } from './RewardState';
import type { User } from './User';

export type Reward = {
  pledge: Pledge;
  user?: User;
  organization?: Organization;
  amount: number;
  state: RewardState;
};

