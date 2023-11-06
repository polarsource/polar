import type { Meta, StoryObj } from '@storybook/react'

import OpenGraphImage from '@/components/Organization/OpenGraphImage'
import { Reactions } from '@polar-sh/sdk'
import { issue, org } from 'polarkit/testdata'

const meta: Meta<typeof OpenGraphImage> = {
  title: 'Organisms/OpenGraphImage',
  component: OpenGraphImage,
  parameters: {
    themes: ['light'],
  },
}

export default meta

type Story = StoryObj<typeof OpenGraphImage>

export const Default: Story = {
  args: {
    org_name: org.name,
    issue_count: 15,
    avatar: org.avatar_url,
    issues: [issue, issue],
  },
  render: (args) => {
    return (
      <div className="absolute">
        <OpenGraphImage {...args} />
      </div>
    )
  },
}

export const IssueToday: Story = {
  args: {
    org_name: org.name,
    issue_count: 15,
    avatar: org.avatar_url,
    issues: [
      { ...issue, issue_created_at: new Date().toISOString() },
      {
        ...issue,
        issue_created_at: new Date(
          new Date().getTime() - 60 * 60 * 24 * 1000,
        ).toISOString(),
        reactions: {
          ...(issue.reactions as Reactions),
          plus_one: 0,
        },
      },
    ],
  },
  render: (args) => {
    return (
      <div className="absolute">
        <OpenGraphImage {...args} />
      </div>
    )
  },
}

export const IssueLongTitle: Story = {
  args: {
    org_name: org.name,
    issue_count: 15,
    avatar: org.avatar_url,
    issues: [
      {
        ...issue,
        title:
          'Lorem ipsum dolor sit amet: Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum',
      },
      issue,
    ],
  },
  render: (args) => {
    return (
      <div className="absolute">
        <OpenGraphImage {...args} />
      </div>
    )
  },
}

export const Repository: Story = {
  args: {
    org_name: org.name,
    repo_name: 'foobar',
    issue_count: 15,
    avatar: org.avatar_url,
    issues: [
      {
        ...issue,
        title:
          'Lorem ipsum dolor sit amet: Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum',
      },
      issue,
    ],
  },
  render: (args) => {
    return (
      <div className="absolute">
        <OpenGraphImage {...args} />
      </div>
    )
  },
}

export const RepositoryLongName: Story = {
  args: {
    org_name: org.name,
    repo_name: 'lorem-ipsum-dorlor-sit-amet-this-is-a-long-name',
    issue_count: 15,
    avatar: org.avatar_url,
    issues: [
      {
        ...issue,
        title:
          'Lorem ipsum dolor sit amet: Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum',
      },
      issue,
    ],
  },
  render: (args) => {
    return (
      <div className="absolute">
        <OpenGraphImage {...args} />
      </div>
    )
  },
}

export const OneIssue: Story = {
  args: {
    org_name: org.name,
    issue_count: 1,
    avatar: org.avatar_url,
    issues: [issue],
  },
  render: (args) => {
    return (
      <div
        className="relative"
        style={{
          height: 630,
          width: 1200,
        }}
      >
        <div className="absolute">
          <OpenGraphImage {...args} />
        </div>
      </div>
    )
  },
}

export const NoIssues: Story = {
  args: {
    org_name: org.name,
    issue_count: 0,
    avatar: org.avatar_url,
    issues: [],
  },
  render: (args) => {
    return (
      <div
        className="relative"
        style={{
          height: 630,
          width: 1200,
        }}
      >
        <div className="absolute">
          <OpenGraphImage {...args} />
        </div>
      </div>
    )
  },
}

export const LargeIssue: Story = {
  args: {
    org_name: org.name,
    issue_count: 0,
    avatar: org.avatar_url,
    issues: [issue],
    largeIssue: true,
  },
  render: (args) => {
    return (
      <div
        className="relative"
        style={{
          height: 630,
          width: 1200,
        }}
      >
        <div className="absolute">
          <OpenGraphImage {...args} />
        </div>
      </div>
    )
  },
}

export const LargeIssueNoReactions: Story = {
  args: {
    org_name: org.name,
    issue_count: 0,
    avatar: org.avatar_url,
    issues: [
      {
        ...issue,
        reactions: {
          ...(issue.reactions as Reactions),
          plus_one: 0,
        },
      },
    ],
    largeIssue: true,
  },
  render: (args) => {
    return (
      <div
        className="relative"
        style={{
          height: 630,
          width: 1200,
        }}
      >
        <div className="absolute">
          <OpenGraphImage {...args} />
        </div>
      </div>
    )
  },
}

export const LargeIssueFundingGoal: Story = {
  args: {
    org_name: org.name,
    issue_count: 0,
    avatar: org.avatar_url,
    issues: [
      {
        ...issue,
        funding: {
          funding_goal: { amount: 5000, currency: 'USD' },
          pledges_sum: { amount: 2000, currency: 'USD' },
        },
      },
    ],
    largeIssue: true,
  },
  render: (args) => {
    return (
      <div
        className="relative"
        style={{
          height: 630,
          width: 1200,
        }}
      >
        <div className="absolute">
          <OpenGraphImage {...args} />
        </div>
      </div>
    )
  },
}
