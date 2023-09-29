/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { PledgeType } from './PledgeType';

export type PledgerPledgePendingNotification = {
  pledge_amount: string;
  issue_url: string;
  issue_title: string;
  issue_number: number;
  issue_org_name: string;
  issue_repo_name: string;
  pledge_date: string;
  pledge_id?: string;
  pledge_type?: PledgeType;
};

