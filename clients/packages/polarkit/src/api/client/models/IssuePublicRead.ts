/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { IssueStatus } from './IssueStatus';
import type { Platforms } from './Platforms';
import type { State } from './State';

export type IssuePublicRead = {
  id: string;
  platform: Platforms;
  organization_id: string;
  repository_id: string;
  number: number;
  title: string;
  labels?: any;
  reactions?: any;
  state: State;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  comments?: number;
  progress?: IssueStatus;
};

