/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type InstallationCreate = {
  platform: InstallationCreate.platform;
  external_id: number;
};

export namespace InstallationCreate {

  export enum platform {
    GITHUB = 'github',
  }


}

