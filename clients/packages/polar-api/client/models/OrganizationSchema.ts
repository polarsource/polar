/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { Status } from './Status';

export type OrganizationSchema = {
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
  id: string;
  status: Status;
  created_at: string;
  modified_at?: string;
};

