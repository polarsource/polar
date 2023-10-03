/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Issue } from './Issue';
import type { IssueReferenceRead } from './IssueReferenceRead';
import type { PledgeRead } from './PledgeRead';

export type IssueExtensionRead = {
  number: number;
  pledges: Array<PledgeRead>;
  references: Array<IssueReferenceRead>;
  issue: Issue;
};

