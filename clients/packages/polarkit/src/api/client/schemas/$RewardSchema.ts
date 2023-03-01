/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RewardSchema = {
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
    repository_id: {
      type: 'string',
    },
    repository_name: {
      type: 'string',
      isRequired: true,
    },
    number: {
      type: 'number',
      isRequired: true,
    },
    title: {
      type: 'string',
      isRequired: true,
    },
    body: {
      type: 'string',
    },
    comments: {
      type: 'number',
    },
    author: {
      properties: {
      },
    },
    author_association: {
      type: 'string',
    },
    labels: {
      type: 'array',
      contains: {
        properties: {
        },
      },
    },
    assignee: {
      properties: {
      },
    },
    assignees: {
      type: 'array',
      contains: {
        properties: {
        },
      },
    },
    milestone: {
      properties: {
      },
    },
    closed_by: {
      properties: {
      },
    },
    reactions: {
      properties: {
      },
    },
    state: {
      type: 'State',
      isRequired: true,
    },
    state_reason: {
      type: 'string',
    },
    is_locked: {
      type: 'boolean',
      isRequired: true,
    },
    lock_reason: {
      type: 'string',
    },
    issue_closed_at: {
      type: 'string',
      format: 'date-time',
    },
    issue_modified_at: {
      type: 'string',
      format: 'date-time',
    },
    issue_created_at: {
      type: 'string',
      isRequired: true,
      format: 'date-time',
    },
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
  },
} as const;
