/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';

export type OAuthAccountRead = {
  created_at: string;
  modified_at?: string;
  platform: Platforms;
  account_id: string;
  account_email: string;
};

