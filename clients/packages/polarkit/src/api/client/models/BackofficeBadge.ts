/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type BackofficeBadge = {
  org_slug: string;
  repo_slug: string;
  issue_number: number;
  action: BackofficeBadge.action;
};

export namespace BackofficeBadge {

  export enum action {
    EMBED = 'embed',
    REMOVE = 'remove',
  }


}

