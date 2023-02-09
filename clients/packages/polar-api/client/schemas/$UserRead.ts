/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UserRead = {
  description: `Base User model.`,
  properties: {
    profile: {
      properties: {
      },
      isRequired: true,
    },
    id: {
      properties: {
      },
    },
    email: {
      type: 'string',
      isRequired: true,
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
