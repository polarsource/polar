/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { PledgeState } from './PledgeState';
import type { PledgeType } from './PledgeType';

export type PledgeRead = {
  id: string;
  created_at: string;
  issue_id: string;
  amount: number;
  repository_id: string;
  organization_id: string;
  pledger_user_id?: string;
  state: PledgeState;
  /**
   * Type of pledge
   */
  type: PledgeType;
  pledger_name?: string;
  pledger_avatar?: string;
  authed_user_can_admin?: boolean;
  scheduled_payout_at?: string;
  paid_at?: string;
  refunded_at?: string;
  authed_user_can_admin_sender?: boolean;
  authed_user_can_admin_received?: boolean;
};

