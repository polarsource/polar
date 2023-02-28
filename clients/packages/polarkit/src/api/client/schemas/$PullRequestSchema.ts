/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $PullRequestSchema = {
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
    commits: {
      type: 'number',
    },
    additions: {
      type: 'number',
    },
    deletions: {
      type: 'number',
    },
    changed_files: {
      type: 'number',
    },
    requested_reviewers: {
      type: 'array',
      contains: {
        properties: {
        },
      },
    },
    requested_teams: {
      type: 'array',
      contains: {
        properties: {
        },
      },
    },
    is_draft: {
      type: 'boolean',
      isRequired: true,
    },
    is_rebaseable: {
      type: 'boolean',
    },
    review_comments: {
      type: 'number',
    },
    maintainer_can_modify: {
      type: 'boolean',
    },
    is_mergeable: {
      type: 'boolean',
    },
    mergeable_state: {
      type: 'string',
    },
    auto_merge: {
      type: 'string',
    },
    is_merged: {
      type: 'boolean',
    },
    merged_by: {
      properties: {
      },
    },
    merged_at: {
      type: 'string',
      format: 'date-time',
    },
    merge_commit_sha: {
      type: 'string',
    },
    head: {
      properties: {
      },
    },
    base: {
      properties: {
      },
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
    modified_at: {
      type: 'string',
      format: 'date-time',
    },
  },
} as const;
