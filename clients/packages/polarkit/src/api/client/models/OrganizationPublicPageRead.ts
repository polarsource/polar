/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssuePublicRead } from './IssuePublicRead';
import type { OrganizationPublicRead } from './OrganizationPublicRead';
import type { RepositoryPublicRead } from './RepositoryPublicRead';

export type OrganizationPublicPageRead = {
  organization: OrganizationPublicRead;
  repositories: Array<RepositoryPublicRead>;
  issues: Array<IssuePublicRead>;
  total_issue_count: number;
};

