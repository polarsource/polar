/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { RepositoryBadgeSettingsUpdate } from './RepositoryBadgeSettingsUpdate';

export type OrganizationBadgeSettingsUpdate = {
  retroactive: boolean;
  show_amount: boolean;
  repositories: Array<RepositoryBadgeSettingsUpdate>;
};

