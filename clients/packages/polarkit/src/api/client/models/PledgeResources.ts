/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { OrganizationPublicRead } from './OrganizationPublicRead';
import type { PledgeRead } from './PledgeRead';
import type { RepositoryRead } from './RepositoryRead';

export type PledgeResources = {
  pledge?: PledgeRead;
  issue?: IssueRead;
  organization?: OrganizationPublicRead;
  repository?: RepositoryRead;
};

