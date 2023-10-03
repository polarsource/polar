/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type PledgeStripePaymentIntentCreate = {
  issue_id: string;
  email: string;
  amount: number;
  setup_future_usage?: PledgeStripePaymentIntentCreate.setup_future_usage;
};

export namespace PledgeStripePaymentIntentCreate {

  export enum setup_future_usage {
    ON_SESSION = 'on_session',
  }


}

