/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { Visibility } from './Visibility';

export type RepositoryLegacyRead = {
  id: string;
  platform: Platforms;
  visibility: Visibility;
  name: string;
  description?: string;
  stars?: number;
  license?: string;
  homepage?: string;
};

