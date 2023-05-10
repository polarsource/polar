/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { RepositoryRead } from './RepositoryRead';
import type { Status } from './Status';

export type OrganizationPrivateRead = {
  pledge_badge_show_amount?: boolean;
  email_notification_maintainer_issue_receives_backing?: boolean;
  email_notification_maintainer_issue_branch_created?: boolean;
  email_notification_maintainer_pull_request_created?: boolean;
  email_notification_maintainer_pull_request_merged?: boolean;
  email_notification_backed_issue_branch_created?: boolean;
  email_notification_backed_issue_pull_request_created?: boolean;
  email_notification_backed_issue_pull_request_merged?: boolean;
  billing_email?: string;
  platform: Platforms;
  name: string;
  avatar_url: string;
  external_id: number;
  is_personal: boolean;
  installation_id?: number;
  installation_created_at?: string;
  installation_updated_at?: string;
  installation_suspended_at?: string;
  onboarded_at?: string;
  id: string;
  status: Status;
  created_at: string;
  modified_at?: string;
  repositories?: Array<RepositoryRead>;
};

