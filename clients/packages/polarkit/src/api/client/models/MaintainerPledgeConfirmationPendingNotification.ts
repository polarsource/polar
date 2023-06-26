/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type MaintainerPledgeConfirmationPendingNotification = {
  pledger_name: string;
  pledge_amount: string;
  issue_url: string;
  issue_title: string;
  issue_org_name: string;
  issue_repo_name: string;
  issue_number: number;
  maintainer_has_stripe_account: boolean;
  pledge_id?: string;
};

