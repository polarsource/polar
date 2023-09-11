/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreatePledgeFromPaymentIntent } from '../models/CreatePledgeFromPaymentIntent';
import type { ListResource_Pledge_ } from '../models/ListResource_Pledge_';
import type { Platforms } from '../models/Platforms';
import type { Pledge } from '../models/Pledge';
import type { PledgeRead } from '../models/PledgeRead';
import type { PledgeStripePaymentIntentCreate } from '../models/PledgeStripePaymentIntentCreate';
import type { PledgeStripePaymentIntentMutationResponse } from '../models/PledgeStripePaymentIntentMutationResponse';
import type { PledgeStripePaymentIntentUpdate } from '../models/PledgeStripePaymentIntentUpdate';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class PledgesService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Search pledges (Public API)
   * Search pledges. Requires authentication. The user can only read pledges that they have made (personally or via an organization) or received (to organizations that they are a member of).
   * @returns ListResource_Pledge_ Successful Response
   * @throws ApiError
   */
  public search({
    platform,
    organizationName,
    repositoryName,
    issueId,
  }: {
    platform?: Platforms,
    /**
     * Search pledges in the organization with this name. Requires platform to be set.
     */
    organizationName?: string,
    /**
     * Search pledges in the repository with this name. Can only be used if organization_name is set.
     */
    repositoryName?: string,
    /**
     * Search pledges to this issue
     */
    issueId?: string,
  }): CancelablePromise<ListResource_Pledge_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/pledges/search',
      query: {
        'platform': platform,
        'organization_name': organizationName,
        'repository_name': repositoryName,
        'issue_id': issueId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get pledge (Public API)
   * Get a pledge. Requires authentication.
   * @returns Pledge Successful Response
   * @throws ApiError
   */
  public get({
    id,
  }: {
    id: string,
  }): CancelablePromise<Pledge> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/pledges/{id}',
      path: {
        'id': id,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Create
   * Creates a pledge from a payment intent
   * @returns Pledge Successful Response
   * @throws ApiError
   */
  public create({
    requestBody,
  }: {
    requestBody: CreatePledgeFromPaymentIntent,
  }): CancelablePromise<Pledge> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/pledges',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Create Payment Intent
   * @returns PledgeStripePaymentIntentMutationResponse Successful Response
   * @throws ApiError
   */
  public createPaymentIntent({
    requestBody,
  }: {
    requestBody: PledgeStripePaymentIntentCreate,
  }): CancelablePromise<PledgeStripePaymentIntentMutationResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/pledges/payment_intent',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Bad Request`,
        403: `Forbidden`,
        404: `Not Found`,
        422: `Validation Error`,
      },
    });
  }

  /**
   * Update Payment Intent
   * @returns PledgeStripePaymentIntentMutationResponse Successful Response
   * @throws ApiError
   */
  public updatePaymentIntent({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: PledgeStripePaymentIntentUpdate,
  }): CancelablePromise<PledgeStripePaymentIntentMutationResponse> {
    return this.httpRequest.request({
      method: 'PATCH',
      url: '/api/v1/pledges/payment_intent/{id}',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Dispute Pledge
   * @returns PledgeRead Successful Response
   * @throws ApiError
   */
  public disputePledge({
    pledgeId,
    reason,
  }: {
    pledgeId: string,
    reason: string,
  }): CancelablePromise<PledgeRead> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/pledges/{pledge_id}/dispute',
      path: {
        'pledge_id': pledgeId,
      },
      query: {
        'reason': reason,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
