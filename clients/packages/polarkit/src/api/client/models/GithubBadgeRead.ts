/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { BadgeAmount } from './BadgeAmount';

export type GithubBadgeRead = {
  badge_type: GithubBadgeRead.badge_type;
  width?: number;
  height?: number;
  amount?: BadgeAmount;
};

export namespace GithubBadgeRead {

  export enum badge_type {
    PLEDGE = 'pledge',
  }


}

