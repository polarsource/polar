/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $IssueSchema = {
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
      isRequired: true,
      format: 'uuid',
    },
    repository_id: {
      type: 'string',
      isRequired: true,
      format: 'uuid',
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
      type: 'any',
    },
    author_association: {
      type: 'string',
    },
    labels: {
      type: 'any',
    },
    assignee: {
      type: 'any',
    },
    assignees: {
      type: 'any',
    },
    milestone: {
      type: 'any',
    },
    closed_by: {
      type: 'any',
    },
    reactions: {
      type: 'any',
    },
    state: {
      type: 'polar__models__issue__IssueFields__State',
      isRequired: true,
    },
    state_reason: {
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
