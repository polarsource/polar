import {
  OrganizationPrivateRead,
  Platforms,
} from '@/../../../packages/polarkit/src/api/client'
import RepoSelection from '@/components/Dashboard/RepoSelection'
import type { Meta, StoryObj } from '@storybook/react'
import { privateOrganization, user } from './testdata'

const meta: Meta<typeof RepoSelection> = {
  title: 'Organisms/RepoSelection',
  component: RepoSelection,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof RepoSelection>

export const Default: Story = {
  args: {
    showUserInDropdown: true,
    organizations: [privateOrganization],
    currentUser: user,
    initOpen: true,
  },
  render: (args) => (
    <div className="h-[300px]">
      <RepoSelection {...args} />
    </div>
  ),
}

const selfUserOrg: OrganizationPrivateRead = {
  id: 'xxxxx-abc-selfuserorg',
  platform: Platforms.GITHUB,
  name: 'zegl',
  external_id: 123,
  is_personal: false,
  created_at: '2023-01-01',
  avatar_url: 'https://avatars.githubusercontent.com/u/47952?v=4',
  pledge_minimum_amount: 2000,
}

export const WithSelfUserOrgInstalled: Story = {
  args: {
    showUserInDropdown: true,
    organizations: [privateOrganization, selfUserOrg],
    currentUser: user,
    initOpen: true,
  },
  render: (args) => (
    <div className="h-[300px]">
      <RepoSelection {...args} />
    </div>
  ),
}

export const showRepositories: Story = {
  args: {
    showUserInDropdown: true,
    organizations: [privateOrganization],
    currentUser: user,
    initOpen: true,
    showRepositories: true,
    showConnectMore: true,
    showOrganizationRepositoryCount: true,
  },
  render: (args) => (
    <div className="h-[300px]">
      <RepoSelection {...args} />
    </div>
  ),
}
