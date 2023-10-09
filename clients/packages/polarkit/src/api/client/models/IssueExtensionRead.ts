/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Issue } from './Issue';
import type { IssueReferenceRead } from './IssueReferenceRead';
import type { Pledge } from './Pledge';

export type IssueExtensionRead = {
  number: number;
  pledges: Array<Pledge>;
  references: Array<IssueReferenceRead>;
  issue: Issue;
};

