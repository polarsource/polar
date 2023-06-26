/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { RepositoryBadgeSettingsRead } from './RepositoryBadgeSettingsRead';

export type OrganizationBadgeSettingsRead = {
  show_amount: boolean;
  message?: string;
  repositories: Array<RepositoryBadgeSettingsRead>;
};

