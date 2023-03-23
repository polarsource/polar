/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type PullRequestReference = {
  id: string;
  title: string;
  author_login: string;
  author_avatar: string;
  number: number;
  organization_name: string;
  repository_name: string;
  additions: number;
  deletions: number;
  state: string;
  created_at: string;
  merged_at?: string;
  closed_at?: string;
};

