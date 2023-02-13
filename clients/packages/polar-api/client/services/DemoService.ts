/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateDemo } from '../models/CreateDemo';
import type { DemoSchema } from '../models/DemoSchema';
import type { UpdateDemo } from '../models/UpdateDemo';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class DemoService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * Get All
   * @returns DemoSchema Successful Response
   * @throws ApiError
   */
  public getAll(): CancelablePromise<Array<DemoSchema>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/demo/',
    });
  }

  /**
   * Create
   * @returns DemoSchema Successful Response
   * @throws ApiError
   */
  public create({
    requestBody,
  }: {
    requestBody: CreateDemo,
  }): CancelablePromise<DemoSchema> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/api/v1/demo/',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Get
   * @returns DemoSchema Successful Response
   * @throws ApiError
   */
  public get({
    demoId,
  }: {
    demoId: string,
  }): CancelablePromise<DemoSchema> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/demo/{demo_id}',
      path: {
        'demo_id': demoId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Update
   * @returns DemoSchema Successful Response
   * @throws ApiError
   */
  public update({
    demoId,
    requestBody,
  }: {
    demoId: string,
    requestBody: UpdateDemo,
  }): CancelablePromise<DemoSchema> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/api/v1/demo/{demo_id}',
      path: {
        'demo_id': demoId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }

  /**
   * Delete
   * @returns void
   * @throws ApiError
   */
  public delete({
    demoId,
  }: {
    demoId: string,
  }): CancelablePromise<void> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/api/v1/demo/{demo_id}',
      path: {
        'demo_id': demoId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }

}
