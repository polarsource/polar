/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { polar__pledge__schemas__State } from './polar__pledge__schemas__State';

export type PledgeRead = {
  id: string;
  created_at: string;
  issue_id: string;
  amount: number;
  repository_id: string;
  organization_id: string;
  state: polar__pledge__schemas__State;
  pledger_name?: string;
  pledger_avatar?: string;
  client_secret?: string;
};

