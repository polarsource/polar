/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { Visibility } from './Visibility';

export type RepositoryPublicRead = {
  platform: Platforms;
  id: string;
  visibility: Visibility;
  name: string;
  description?: string;
  stars?: number;
  license?: string;
  homepage?: string;
};

