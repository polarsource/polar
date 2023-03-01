/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RewardSchema = {
  properties: {
    issue_id: {
      type: 'string',
      isRequired: true,
    },
    amount: {
      type: 'number',
      isRequired: true,
    },
    id: {
      type: 'string',
      isRequired: true,
    },
    created_at: {
      type: 'string',
      isRequired: true,
      format: 'date-time',
    },
    repository_id: {
      type: 'string',
      isRequired: true,
    },
    organization_id: {
      type: 'string',
      isRequired: true,
    },
  },
} as const;
