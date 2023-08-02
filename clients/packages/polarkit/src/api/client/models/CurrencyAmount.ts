/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type CurrencyAmount = {
  /**
   * Three letter currency code (eg: USD)
   */
  currency: string;
  /**
   * Amount in the currencys smallest unit (cents if currency is USD)
   */
  amount: number;
};

