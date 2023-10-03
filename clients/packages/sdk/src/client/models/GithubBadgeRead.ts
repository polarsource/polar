/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Funding } from './Funding';

export type GithubBadgeRead = {
  badge_type: GithubBadgeRead.badge_type;
  amount: number;
  funding: Funding;
};

export namespace GithubBadgeRead {

  export enum badge_type {
    PLEDGE = 'pledge',
  }


}

