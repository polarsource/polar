/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CreateReward = {
  properties: {
    issue_id: {
      type: 'string',
      isRequired: true,
    },
    amount: {
      type: 'number',
      isRequired: true,
    },
  },
} as const;
