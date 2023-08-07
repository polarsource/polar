/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Issue } from './Issue';
import type { Organization } from './Organization';
import type { Repository } from './Repository';

export type IssueResources = {
  issue: Issue;
  organization?: Organization;
  repository?: Repository;
};

