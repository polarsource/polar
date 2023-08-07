/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Issue } from './Issue';
import type { Organization } from './Organization';
import type { PledgeRead } from './PledgeRead';
import type { Repository } from './Repository';

export type PledgeResources = {
  pledge: PledgeRead;
  issue?: Issue;
  organization?: Organization;
  repository?: Repository;
};

