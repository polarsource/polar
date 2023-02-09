/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UserUpdate = {
  properties: {
    profile: {
      properties: {
      },
      isRequired: true,
    },
    password: {
      type: 'string',
    },
    email: {
      type: 'string',
      format: 'email',
    },
    is_active: {
      type: 'boolean',
    },
    is_superuser: {
      type: 'boolean',
    },
    is_verified: {
      type: 'boolean',
    },
  },
} as const;
