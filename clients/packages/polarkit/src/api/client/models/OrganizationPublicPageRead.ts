/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssuePublicRead } from './IssuePublicRead';
import type { Organization } from './Organization';
import type { Repository } from './Repository';

export type OrganizationPublicPageRead = {
  organization: Organization;
  repositories: Array<Repository>;
  issues: Array<IssuePublicRead>;
  total_issue_count: number;
};

