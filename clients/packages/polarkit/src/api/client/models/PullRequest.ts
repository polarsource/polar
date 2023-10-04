/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Author } from './Author';

export type PullRequest = {
  id: string;
  number: number;
  title: string;
  author?: Author;
};

