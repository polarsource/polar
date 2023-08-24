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
  funding: Funding;
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

