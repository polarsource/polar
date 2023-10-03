/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { RepositoryBadgeSettingsRead } from './RepositoryBadgeSettingsRead';

export type OrganizationBadgeSettingsRead = {
  show_amount: boolean;
  minimum_amount: number;
  message?: string;
  repositories: Array<RepositoryBadgeSettingsRead>;
};

