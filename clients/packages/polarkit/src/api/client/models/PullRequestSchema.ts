/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { polar__models__issue__IssueFields__State } from './polar__models__issue__IssueFields__State';

export type PullRequestSchema = {
  platform: Platforms;
  external_id: number;
  organization_id: string;
  repository_id: string;
  number: number;
  title: string;
  body?: string;
  comments?: number;
  author?: ;
  author_association?: string;
  labels?: ;
  assignee?: ;
  assignees?: ;
  milestone?: ;
  closed_by?: ;
  reactions?: ;
  state: polar__models__issue__IssueFields__State;
  state_reason?: string;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  requested_reviewers?: ;
  requested_teams?: ;
  is_merged?: boolean;
  merged_at?: string;
  merge_commit_sha?: string;
  head?: ;
  base?: ;
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  review_comments?: number;
  maintainer_can_modify?: boolean;
  is_mergeable?: boolean;
  mergeable_state?: string;
  merged_by?: ;
  id: string;
  created_at: string;
  modified_at?: string;
};

