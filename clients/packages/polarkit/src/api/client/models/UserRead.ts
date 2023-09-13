/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { OAuthAccountRead } from './OAuthAccountRead';

export type UserRead = {
  username: string;
  email: string;
  avatar_url?: string;
  profile: any;
  id: string;
  accepted_terms_of_service: boolean;
  email_newsletters_and_changelogs: boolean;
  email_promotions_and_events: boolean;
  oauth_accounts: Array<OAuthAccountRead>;
};

