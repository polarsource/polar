/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { CurrencyAmount } from './CurrencyAmount';
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
   * Github's ID (not the same as the #number)
   */
  external_id: number;
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
  /**
   * Github reactions
   */
  reactions?: Reactions;
  state: Issue.state;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  funding_goal?: CurrencyAmount;
  /**
   * The repository that the issue is in
   */
  repository: Repository;
};

export namespace Issue {

  export enum state {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
  }


}

