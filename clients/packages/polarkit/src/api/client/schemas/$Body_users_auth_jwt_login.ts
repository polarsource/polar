/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $Body_users_auth_jwt_login = {
  properties: {
    grant_type: {
      type: 'string',
      pattern: 'password',
    },
    username: {
      type: 'string',
      isRequired: true,
    },
    password: {
      type: 'string',
      isRequired: true,
    },
    scope: {
      type: 'string',
    },
    client_id: {
      type: 'string',
    },
    client_secret: {
      type: 'string',
    },
  },
} as const;
