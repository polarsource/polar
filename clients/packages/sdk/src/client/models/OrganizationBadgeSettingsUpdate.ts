/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { RepositoryBadgeSettingsUpdate } from './RepositoryBadgeSettingsUpdate';

export type OrganizationBadgeSettingsUpdate = {
  show_amount: boolean;
  minimum_amount: number;
  message: string;
  repositories: Array<RepositoryBadgeSettingsUpdate>;
};

