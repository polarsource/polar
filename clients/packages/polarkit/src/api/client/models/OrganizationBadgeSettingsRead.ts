/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { RepositoryBadgeSettingsRead } from './RepositoryBadgeSettingsRead';

export type OrganizationBadgeSettingsRead = {
  retroactive: boolean;
  show_amount: boolean;
  repositories: Array<RepositoryBadgeSettingsRead>;
};

