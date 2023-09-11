/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ListResource_PaymentMethod_ } from '../models/ListResource_PaymentMethod_';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class PaymentMethodsService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * List
   * @returns ListResource_PaymentMethod_ Successful Response
   * @throws ApiError
   */
  public list(): CancelablePromise<ListResource_PaymentMethod_> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/api/v1/payment_methods',
    });
  }

}
