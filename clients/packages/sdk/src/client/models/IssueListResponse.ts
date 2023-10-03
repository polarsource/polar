/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Entry_Any_ } from './Entry_Any_';
import type { Entry_Issue_ } from './Entry_Issue_';
import type { PaginationResponse } from './PaginationResponse';

export type IssueListResponse = {
  data: Array<Entry_Issue_>;
  included?: Array<Entry_Any_>;
  pagination: PaginationResponse;
};

