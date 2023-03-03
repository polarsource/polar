/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { polar__models__issue__IssueFields__State } from './polar__models__issue__IssueFields__State';

export type PullRequestRead = {
  platform: Platforms;
  external_id: number;
  organization_id: string;
  repository_id: string;
  number: number;
  title: string;
  body?: string;
  comments?: number;
  author?: any;
  author_association?: string;
  labels?: any;
  assignee?: any;
  assignees?: any;
  milestone?: any;
  closed_by?: any;
  reactions?: any;
  state: polar__models__issue__IssueFields__State;
  state_reason?: string;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  requested_reviewers?: any;
  requested_teams?: any;
  is_merged?: boolean;
  merged_at?: string;
  merge_commit_sha?: string;
  head?: any;
  base?: any;
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  review_comments?: number;
  maintainer_can_modify?: boolean;
  is_mergeable?: boolean;
  mergeable_state?: string;
  merged_by?: any;
  id: string;
  created_at: string;
  modified_at?: string;
};

