/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Organization } from './Organization';
import type { Platforms } from './Platforms';
import type { Visibility } from './Visibility';

export type Repository = {
  id: string;
  platform: Platforms;
  visibility: Visibility;
  name: string;
  description?: string;
  stars?: number;
  license?: string;
  homepage?: string;
  organization: Organization;
};

