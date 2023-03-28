/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { OrganizationRead } from './OrganizationRead';
import type { PledgeRead } from './PledgeRead';
import type { RepositoryRead } from './RepositoryRead';

export type PledgeResources = {
  pledge?: PledgeRead;
  issue?: IssueRead;
  organization?: OrganizationRead;
  repository?: RepositoryRead;
};

