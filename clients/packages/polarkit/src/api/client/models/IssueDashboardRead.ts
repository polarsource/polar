/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { polar__models__issue__IssueFields__State } from './polar__models__issue__IssueFields__State';

export type IssueDashboardRead = {
  id: string;
  platform: Platforms;
  organization_id: string;
  repository_id: string;
  number: number;
  title: string;
  author?: any;
  labels?: any;
  closed_by?: any;
  reactions?: any;
  state: polar__models__issue__IssueFields__State;
  state_reason?: string;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  comments?: number;
};

