/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueRead } from './IssueRead';
import type { Organization } from './Organization';
import type { Repository } from './Repository';

export type IssueResources = {
  issue: IssueRead;
  organization?: Organization;
  repository?: Repository;
};

