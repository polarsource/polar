/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OrganizationSchema = {
  properties: {
    platform: {
      type: 'Platforms',
      isRequired: true,
    },
    name: {
      type: 'string',
      isRequired: true,
    },
    external_id: {
      type: 'number',
      isRequired: true,
    },
    avatar_url: {
      type: 'string',
      isRequired: true,
    },
    is_personal: {
      type: 'boolean',
      isRequired: true,
    },
    is_site_admin: {
      type: 'boolean',
      isRequired: true,
    },
    installation_id: {
      type: 'number',
      isRequired: true,
    },
    installation_created_at: {
      type: 'string',
      isRequired: true,
      format: 'date-time',
    },
    installation_updated_at: {
      type: 'string',
      format: 'date-time',
    },
    installation_suspended_at: {
      type: 'string',
      format: 'date-time',
    },
    id: {
      type: 'string',
      isRequired: true,
    },
    status: {
      type: 'Status',
      isRequired: true,
    },
    created_at: {
      type: 'string',
      isRequired: true,
      format: 'date-time',
    },
    modified_at: {
      type: 'string',
      format: 'date-time',
    },
    repositories: {
      type: 'array',
      contains: {
        type: 'RepositorySchema',
      },
    },
  },
} as const;
