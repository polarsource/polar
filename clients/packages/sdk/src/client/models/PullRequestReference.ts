/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type PullRequestReference = {
  id: string;
  title: string;
  author_login: string;
  author_avatar: string;
  number: number;
  additions: number;
  deletions: number;
  state: string;
  created_at: string;
  merged_at?: string;
  closed_at?: string;
  is_draft: boolean;
};

