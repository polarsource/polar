/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Funding } from './Funding';
import type { Label } from './Label';
import type { Platforms } from './Platforms';
import type { Reactions } from './Reactions';
import type { Repository } from './Repository';

export type Issue = {
  id: string;
  /**
   * Issue platform (currently always Github)
   */
  platform: Platforms;
  /**
   * Github #number
   */
  number: number;
  /**
   * Github issue title
   */
  title: string;
  /**
   * Github issue body
   */
  body?: string;
  /**
   * Number of Github comments made on the issue
   */
  comments?: number;
  labels?: Array<Label>;
  /**
   * Github reactions
   */
  reactions?: Reactions;
  state: Issue.state;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  /**
   * If a maintainer needs to mark this issue as solved
   */
  needs_confirmation_solved: boolean;
  /**
   * If this issue has been marked as confirmed solved through Polar
   */
  confirmed_solved_at?: string;
  funding: Funding;
  /**
   * The repository that the issue is in
   */
  repository: Repository;
  /**
   * Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).
   */
  upfront_split_to_contributors?: number;
};

export namespace Issue {

  export enum state {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
  }


}

