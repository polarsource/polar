/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { ExternalGitHubCommitReference } from './ExternalGitHubCommitReference';
import type { ExternalGitHubPullRequestReference } from './ExternalGitHubPullRequestReference';
import type { IssueReferenceType } from './IssueReferenceType';
import type { PullRequestReference } from './PullRequestReference';

export type IssueReferenceRead = {
  id: string;
  type: IssueReferenceType;
  payload: (PullRequestReference | ExternalGitHubPullRequestReference | ExternalGitHubCommitReference);
};

