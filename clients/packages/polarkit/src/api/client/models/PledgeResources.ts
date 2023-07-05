/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { Organization } from './Organization';
import type { PledgeRead } from './PledgeRead';
import type { RepositoryRead } from './RepositoryRead';

export type PledgeResources = {
  pledge: PledgeRead;
  issue?: IssueRead;
  organization?: Organization;
  repository?: RepositoryRead;
};

