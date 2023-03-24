/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { RepositoryRead } from './RepositoryRead';
import type { Status } from './Status';

export type OrganizationRead = {
  funding_badge_retroactive?: boolean;
  funding_badge_show_amount?: boolean;
  email_notification_issue_receives_backing?: boolean;
  email_notification_backed_issue_branch_created?: boolean;
  email_notification_backed_issue_pull_request_created?: boolean;
  email_notification_backed_issue_pull_request_merged?: boolean;
  platform: Platforms;
  name: string;
  external_id: number;
  avatar_url: string;
  is_personal: boolean;
  is_site_admin: boolean;
  installation_id: number;
  installation_created_at: string;
  installation_updated_at?: string;
  installation_suspended_at?: string;
  onboarded_at?: string;
  id: string;
  status: Status;
  created_at: string;
  modified_at?: string;
  repositories?: Array<RepositoryRead>;
};

