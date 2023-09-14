/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Funding } from './Funding';
import type { IssueStatus } from './IssueStatus';
import type { Platforms } from './Platforms';
import type { State } from './State';

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
  state: State;
  state_reason?: string;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  comments?: number;
  progress?: IssueStatus;
  badge_custom_content?: string;
  funding: Funding;
  pledge_badge_currently_embedded: boolean;
  /**
   * If a maintainer needs to mark this issue as solved
   */
  needs_confirmation_solved: boolean;
  /**
   * If this issue has been marked as confirmed solved through Polar
   */
  confirmed_solved_at?: string;
};

