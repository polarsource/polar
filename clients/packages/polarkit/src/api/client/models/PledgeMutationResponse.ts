/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { PledgeState } from './PledgeState';

export type PledgeMutationResponse = {
  issue_id: string;
  email?: string;
  amount: number;
  pledge_as_org?: string;
  id: string;
  state: PledgeState;
  fee: number;
  amount_including_fee: number;
  client_secret?: string;
};

