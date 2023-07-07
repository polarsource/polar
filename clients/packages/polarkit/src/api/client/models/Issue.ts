/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Platforms } from './Platforms';
import type { Reactions } from './Reactions';
import type { Repository } from './Repository';

export type Issue = {
  id: string;
  platform: Platforms;
  external_id: number;
  number: number;
  title: string;
  body?: string;
  comments?: number;
  reactions?: Reactions;
  state: Issue.state;
  issue_closed_at?: string;
  issue_modified_at?: string;
  issue_created_at: string;
  repository: Repository;
};

export namespace Issue {

  export enum state {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
  }


}

