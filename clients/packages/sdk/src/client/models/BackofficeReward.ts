/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CurrencyAmount } from './CurrencyAmount';
import type { Organization } from './Organization';
import type { Pledge } from './Pledge';
import type { RewardState } from './RewardState';
import type { User } from './User';

export type BackofficeReward = {
  /**
   * The pledge that the reward was split from
   */
  pledge: Pledge;
  /**
   * The user that received the reward (if any)
   */
  user?: User;
  /**
   * The organization that received the reward (if any)
   */
  organization?: Organization;
  amount: CurrencyAmount;
  state: RewardState;
  /**
   * If and when the reward was paid out.
   */
  paid_at?: string;
  transfer_id?: string;
  issue_reward_id: string;
  pledge_payment_id?: string;
  pledger_email?: string;
};

