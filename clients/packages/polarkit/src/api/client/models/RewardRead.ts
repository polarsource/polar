/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { polar__reward__schemas__State } from './polar__reward__schemas__State';

export type RewardRead = {
  issue_id: string;
  amount: number;
  id: string;
  created_at: string;
  repository_id: string;
  organization_id: string;
  state: polar__reward__schemas__State;
  client_secret?: string;
};

