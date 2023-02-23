/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ErrorModel = {
  properties: {
    detail: {
      type: 'any-of',
      contains: [{
        type: 'string',
      }, {
        type: 'dictionary',
        contains: {
          type: 'string',
        },
      }],
      isRequired: true,
    },
  },
} as const;
