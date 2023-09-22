import BadgeRepositories from '@/components/Settings/Badge/Repositories'
import type { Meta, StoryObj } from '@storybook/react'
import { RepositoryBadgeSettingsRead } from 'polarkit/api/client'

const meta: Meta<typeof BadgeRepositories> = {
  title: 'Organisms/BadgeRepositories',
  component: BadgeRepositories,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof BadgeRepositories>

const repo: RepositoryBadgeSettingsRead = {
  id: 'aaa',
  avatar_url: 'https://avatars.githubusercontent.com/u/105373340?s=48&v=4',
  name: 'polar',
  synced_issues: 10,
  open_issues: 20,
  auto_embedded_issues: 0,
  label_embedded_issues: 0,
  pull_requests: 5,
  badge_auto_embed: false,
  badge_label: 'Fund',
  is_private: false,
  is_sync_completed: false,
}

export const Default: Story = {
  args: {
    repos: [
      { ...repo, name: 'polar_public' },
      { ...repo, name: 'polar-clients-ios-toolkit-framework-long-name' },
      { ...repo, is_private: true, name: 'polar_private' },
      {
        ...repo,
        synced_issues: 20,
        open_issues: 20,
        is_sync_completed: true,
        name: 'polar_synced',
      },
      {
        ...repo,
        synced_issues: 0,
        open_issues: 0,
        name: 'polar_no_issues',
      },
    ],
    showControls: false,
    isSettingPage: false,
  },
  parameters: {
    // Disable chromatic for this component as it's using animations
    chromatic: { disableSnapshot: true },
  },
}

export const ShowControls: Story = {
  args: {
    ...Default.args,
    showControls: true,
  },
  parameters: {
    // Disable chromatic for this component as it's using animations
    chromatic: { disableSnapshot: true },
  },
}

export const SettingsPage: Story = {
  args: {
    ...Default.args,
    showControls: true,
    isSettingPage: true,
  },
}

export const SettingsPageNoPublic: Story = {
  args: {
    ...Default.args,
    repos: [
      {
        ...repo,
        is_private: true,
        name: 'polar-clients-ios-toolkit-framework-long-name',
      },
      { ...repo, is_private: true, name: 'polar_private' },
    ],
    showControls: true,
    isSettingPage: true,
  },
}
