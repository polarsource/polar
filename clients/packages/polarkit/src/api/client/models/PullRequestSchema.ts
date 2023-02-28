/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { State } from './State';

export type PullRequestSchema = {
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
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  requested_reviewers?: Array<any>;
  requested_teams?: Array<any>;
  is_draft: boolean;
  is_rebaseable?: boolean;
  review_comments?: number;
  maintainer_can_modify?: boolean;
  is_mergeable?: boolean;
  mergeable_state?: string;
  auto_merge?: string;
  is_merged?: boolean;
  merged_by?: any;
  merged_at?: string;
  merge_commit_sha?: string;
  head?: any;
  base?: any;
  id: string;
  created_at: string;
  modified_at?: string;
};

