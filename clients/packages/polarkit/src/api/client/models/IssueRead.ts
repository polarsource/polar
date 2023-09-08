/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { State } from './State';

export type IssueRead = {
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
  state: State;
  state_reason?: string;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  external_lookup_key?: string;
  has_pledge_badge_label?: boolean;
  pledge_badge_currently_embedded?: boolean;
  positive_reactions_count?: number;
  total_engagement_count?: number;
  id: string;
  created_at: string;
  modified_at?: string;
};

