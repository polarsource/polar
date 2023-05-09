/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { PledgeState } from './PledgeState';

export type BackofficePledgeRead = {
  id: string;
  created_at: string;
  issue_id: string;
  amount: number;
  repository_id: string;
  organization_id: string;
  state: PledgeState;
  pledger_name?: string;
  pledger_avatar?: string;
  authed_user_can_admin?: boolean;
  scheduled_payout_at?: string;
  payment_id?: string;
  transfer_id?: string;
  receiver_org_name: string;
  issue_title: string;
  issue_url: string;
  dispute_reason?: string;
  disputed_by_user_id?: string;
  disputed_at?: string;
};

