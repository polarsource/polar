/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $WebhookResponse = {
  properties: {
    success: {
      type: 'boolean',
      isRequired: true,
    },
    message: {
      type: 'string',
    },
    task_id: {
      type: 'string',
    },
  },
} as const;
