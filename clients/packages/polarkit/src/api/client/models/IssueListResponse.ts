/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Entry_Any_ } from './Entry_Any_';
import type { Entry_IssueDashboardRead_ } from './Entry_IssueDashboardRead_';
import type { PaginationResponse } from './PaginationResponse';

export type IssueListResponse = {
  data: Array<Entry_IssueDashboardRead_>;
  included?: Array<Entry_Any_>;
  pagination: PaginationResponse;
};

