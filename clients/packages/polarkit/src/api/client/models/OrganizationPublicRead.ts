/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';

export type OrganizationPublicRead = {
  id: string;
  platform: Platforms;
  name: string;
  avatar_url: string;
  bio?: string;
  pretty_name?: string;
  company?: string;
  blog?: string;
  location?: string;
  email?: string;
  twitter_username?: string;
};

