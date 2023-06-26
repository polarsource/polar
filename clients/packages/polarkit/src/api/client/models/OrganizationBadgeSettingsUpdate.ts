/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { RepositoryBadgeSettingsUpdate } from './RepositoryBadgeSettingsUpdate';

export type OrganizationBadgeSettingsUpdate = {
  show_amount: boolean;
  message: string;
  repositories: Array<RepositoryBadgeSettingsUpdate>;
};

