/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { polar__pledge__schemas__State } from './polar__pledge__schemas__State';

export type PledgeRead = {
  issue_id: string;
  email?: string;
  amount: number;
  pledge_as_org?: string;
  id: string;
  created_at: string;
  repository_id: string;
  organization_id: string;
  state: polar__pledge__schemas__State;
  client_secret?: string;
};

