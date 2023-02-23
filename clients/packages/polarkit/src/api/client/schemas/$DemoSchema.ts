/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $DemoSchema = {
  properties: {
    id: {
      type: 'string',
      isRequired: true,
    },
    created_at: {
      type: 'string',
      isRequired: true,
      format: 'date-time',
    },
    updated_at: {
      type: 'string',
      format: 'date-time',
    },
    testing: {
      type: 'string',
      isRequired: true,
    },
  },
} as const;
