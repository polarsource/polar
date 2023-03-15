/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { OrganizationRead } from './OrganizationRead';
import type { RepositoryRead } from './RepositoryRead';

export type IssuePledge = {
  issue: IssueRead;
  organization: OrganizationRead;
  repository: RepositoryRead;
};

