/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { OrganizationPublicRead } from './OrganizationPublicRead';
import type { RepositoryRead } from './RepositoryRead';

export type IssueResources = {
  issue: IssueRead;
  organization?: OrganizationPublicRead;
  repository?: RepositoryRead;
};

