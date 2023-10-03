/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type PledgeStripePaymentIntentUpdate = {
  email: string;
  amount: number;
  setup_future_usage?: PledgeStripePaymentIntentUpdate.setup_future_usage;
};

export namespace PledgeStripePaymentIntentUpdate {

  export enum setup_future_usage {
    ON_SESSION = 'on_session',
  }


}

