/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssuePublicRead } from './IssuePublicRead';
import type { Organization } from './Organization';
import type { RepositoryPublicRead } from './RepositoryPublicRead';

export type OrganizationPublicPageRead = {
  organization: Organization;
  repositories: Array<RepositoryPublicRead>;
  issues: Array<IssuePublicRead>;
  total_issue_count: number;
};

