/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { State } from './State';

export type IssueSchema = {
  platform: Platforms;
  external_id: number;
  organization_id?: string;
  organization_name: string;
  repository_id?: string;
  repository_name: string;
  number: number;
  title: string;
  body?: string;
  comments?: number;
  author?: any;
  author_association?: string;
  labels?: Array<any>;
  assignee?: any;
  assignees?: Array<any>;
  milestone?: any;
  closed_by?: any;
  reactions?: any;
  state: State;
  state_reason?: string;
  is_locked: boolean;
  lock_reason?: string;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  token: string;
  id: string;
  created_at: string;
  modified_at?: string;
};

