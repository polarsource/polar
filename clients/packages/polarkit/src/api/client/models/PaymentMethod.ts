/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type PaymentMethod = {
  stripe_payment_method_id: string;
  type: PaymentMethod.type;
  brand?: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

export namespace PaymentMethod {

  export enum type {
    CARD = 'card',
  }


}

