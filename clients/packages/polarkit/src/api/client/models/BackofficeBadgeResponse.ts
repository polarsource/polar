/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type BackofficeBadgeResponse = {
  org_slug: string;
  repo_slug: string;
  issue_number: number;
  action: BackofficeBadgeResponse.action;
  success: boolean;
};

export namespace BackofficeBadgeResponse {

  export enum action {
    EMBED = 'embed',
    REMOVE = 'remove',
  }


}

