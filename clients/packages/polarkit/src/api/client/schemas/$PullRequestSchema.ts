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
      type: 'any-of',
      contains: [],
    },
    author_association: {
      type: 'string',
    },
    labels: {
      type: 'any-of',
      contains: [],
    },
    assignee: {
      type: 'any-of',
      contains: [],
    },
    assignees: {
      type: 'any-of',
      contains: [],
    },
    milestone: {
      type: 'any-of',
      contains: [],
    },
    closed_by: {
      type: 'any-of',
      contains: [],
    },
    reactions: {
      type: 'any-of',
      contains: [],
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
    requested_reviewers: {
      type: 'any-of',
      contains: [],
    },
    requested_teams: {
      type: 'any-of',
      contains: [],
    },
    is_merged: {
      type: 'boolean',
    },
    merged_at: {
      type: 'string',
      format: 'date-time',
    },
    merge_commit_sha: {
      type: 'string',
    },
    head: {
      type: 'any-of',
      contains: [],
    },
    base: {
      type: 'any-of',
      contains: [],
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
    merged_by: {
      type: 'any-of',
      contains: [],
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
