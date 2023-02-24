/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RepositorySchema = {
  properties: {
    platform: {
      type: 'Platforms',
      isRequired: true,
    },
    external_id: {
      type: 'number',
      isRequired: true,
    },
    organization_id: {
      type: 'string',
    },
    organization_name: {
      type: 'string',
      isRequired: true,
    },
    name: {
      type: 'string',
      isRequired: true,
    },
    description: {
      type: 'string',
    },
    open_issues: {
      type: 'number',
    },
    forks: {
      type: 'number',
    },
    stars: {
      type: 'number',
    },
    watchers: {
      type: 'number',
    },
    main_branch: {
      type: 'string',
    },
    topics: {
      type: 'array',
      contains: {
        type: 'string',
      },
    },
    license: {
      type: 'string',
    },
    repository_pushed_at: {
      type: 'string',
      format: 'date-time',
    },
    repository_created_at: {
      type: 'string',
      format: 'date-time',
    },
    repository_modified_at: {
      type: 'string',
      format: 'date-time',
    },
    is_private: {
      type: 'boolean',
      isRequired: true,
    },
    is_fork: {
      type: 'boolean',
    },
    is_issues_enabled: {
      type: 'boolean',
    },
    is_projects_enabled: {
      type: 'boolean',
    },
    is_wiki_enabled: {
      type: 'boolean',
    },
    is_pages_enabled: {
      type: 'boolean',
    },
    is_downloads_enabled: {
      type: 'boolean',
    },
    is_archived: {
      type: 'boolean',
    },
    is_disabled: {
      type: 'boolean',
    },
    id: {
      type: 'string',
      isRequired: true,
    },
    visibility: {
      type: 'Visibility',
      isRequired: true,
    },
  },
} as const;
