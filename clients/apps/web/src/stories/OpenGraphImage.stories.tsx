import type { Meta, StoryObj } from '@storybook/react'

import OpenGraphImage from '@/components/Organization/OpenGraphImage'
import { issueRead, org } from './testdata'

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
    issues: [issueRead, issueRead],
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
      { ...issueRead, issue_created_at: new Date().toString() },
      {
        ...issueRead,
        issue_created_at: new Date(
          new Date().getTime() - 60 * 60 * 24 * 1000,
        ).toString(),
        reactions: {
          ...issueRead.reactions,
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
        ...issueRead,
        title:
          'Lorem ipsum dolor sit amet: Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum',
      },
      issueRead,
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
        ...issueRead,
        title:
          'Lorem ipsum dolor sit amet: Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum',
      },
      issueRead,
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
        ...issueRead,
        title:
          'Lorem ipsum dolor sit amet: Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum',
      },
      issueRead,
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
    // issues: IssuePublicRead[],
    issues: [issueRead],
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
    issues: [issueRead],
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
        ...issueRead,
        reactions: {
          ...issueRead.reactions,
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
