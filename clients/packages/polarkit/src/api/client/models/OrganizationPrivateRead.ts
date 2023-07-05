/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { RepositoryRead } from './RepositoryRead';

export type OrganizationPrivateRead = {
  pledge_badge_show_amount?: boolean;
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
  pledge_minimum_amount: number;
  default_badge_custom_content?: string;
  id: string;
  created_at: string;
  modified_at?: string;
  repositories?: Array<RepositoryRead>;
};

