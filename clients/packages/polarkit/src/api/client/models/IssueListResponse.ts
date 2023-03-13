/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Entry_Any_ } from './Entry_Any_';
import type { Entry_IssueRead_ } from './Entry_IssueRead_';

export type IssueListResponse = {
  data: Array<Entry_IssueRead_>;
  included?: Array<Entry_Any_>;
};

