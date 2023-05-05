/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { PledgeState } from './PledgeState';

export type PledgeRead = {
  id: string;
  created_at: string;
  issue_id: string;
  amount: number;
  repository_id: string;
  organization_id: string;
  state: PledgeState;
  pledger_name?: string;
  pledger_avatar?: string;
  authed_user_can_dispute?: boolean;
  scheduled_payout_at?: string;
};

