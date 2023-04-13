/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { polar__pledge__schemas__State } from './polar__pledge__schemas__State';

export type BackofficePledgeRead = {
  id: string;
  created_at: string;
  issue_id: string;
  amount: number;
  repository_id: string;
  organization_id: string;
  state: polar__pledge__schemas__State;
  pledger_name?: string;
  pledger_avatar?: string;
  payment_id?: string;
  transfer_id?: string;
  receiver_org_name: string;
  issue_title: string;
  issue_url: string;
};

