/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Platforms } from '../models/Platforms';
import type { PledgeCreate } from '../models/PledgeCreate';
import type { PledgeRead } from '../models/PledgeRead';
import type { PledgeResources } from '../models/PledgeResources';
import type { PledgeUpdate } from '../models/PledgeUpdate';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class PledgesService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get Pledge With Resources
   * @returns PledgeResources Successful Response
   * @throws ApiError
   */
  public getPledgeWithResources({
    platform,
    orgName,
    repoName,
    number,
    pledgeId,
    include = 'organization,repository,issue',
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    number: number,
    pledgeId?: string,
    include?: string,
  }): CancelablePromise<PledgeResources> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issues/{number}/pledge',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'number': number,
      },
      query: {
        'pledge_id': pledgeId,
        'include': include,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Create Pledge
   * @returns PledgeRead Successful Response
   * @throws ApiError
   */
  public createPledge({
    platform,
    orgName,
    repoName,
    number,
    requestBody,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    number: number,
    requestBody: PledgeCreate,
  }): CancelablePromise<PledgeRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issues/{number}/pledges',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'number': number,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Update Pledge
   * @returns PledgeRead Successful Response
   * @throws ApiError
   */
  public updatePledge({
    platform,
    orgName,
    repoName,
    number,
    pledgeId,
    requestBody,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
    number: number,
    pledgeId: string,
    requestBody: PledgeUpdate,
  }): CancelablePromise<PledgeRead> {
    return this.httpRequest.request({
      method: 'PATCH',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/issues/{number}/pledges/{pledge_id}',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
        'number': number,
        'pledge_id': pledgeId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get Repository Pledges
   * @returns PledgeRead Successful Response
   * @throws ApiError
   */
  public getRepositoryPledges({
    platform,
    orgName,
    repoName,
  }: {
    platform: Platforms,
    orgName: string,
    repoName: string,
  }): CancelablePromise<Array<PledgeRead>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/{platform}/{org_name}/{repo_name}/pledges',
      path: {
        'platform': platform,
        'org_name': orgName,
        'repo_name': repoName,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
