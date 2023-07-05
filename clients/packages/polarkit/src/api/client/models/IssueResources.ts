/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { Organization } from './Organization';
import type { RepositoryRead } from './RepositoryRead';

export type IssueResources = {
  issue: IssueRead;
  organization?: Organization;
  repository?: RepositoryRead;
};

