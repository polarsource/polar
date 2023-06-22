import PublicLayout from '@/components/Layout/PublicLayout'
import RepositoryPublicPage from '@/components/Organization/RepositoryPublicPage'
import type { Meta, StoryObj } from '@storybook/react'
import { issue, org, repo } from './testdata'

const meta: Meta<typeof RepositoryPublicPage> = {
  title: 'Pages/RepositoryPublicPage',
  component: RepositoryPublicPage,
}

export default meta

type Story = StoryObj<typeof RepositoryPublicPage>

const orgWithBio = {
  ...org,
  bio: "Giving open source maintainers a funded backlog. Currently in Alpha. Let's fix open source funding",
  company: 'Polar Software Inc',
  blog: 'https://polar.sh/',
  location: 'Stockholm, Sweden',
  email: 'help@polar.sh',
  twitter_username: 'polar_sh',
}

const repoWithData = {
  ...repo,
  stars: 2303,
  homepage: 'google.com',
}

export const Default: Story = {
  parameters: {
    chromatic: { viewports: [390, 1200] },
    themes: ['light'],
  },

  args: {
    organization: orgWithBio,
    repository: repoWithData,
    issues: [issue, issue, issue, issue, issue, issue],
  },
  render: (args) => {
    return (
      <PublicLayout>
        <RepositoryPublicPage {...args} />
      </PublicLayout>
    )
  },
}

export const Dark: Story = {
  ...Default,
  parameters: {
    ...Default.parameters,
    themes: ['dark'],
  },
}

export const WithoutBio: Story = {
  ...Default,
  args: {
    organization: org,
    repository: repo,
    issues: [issue, issue, issue, issue, issue, issue],
  },
}

export const WithoutBioAndLicense: Story = {
  ...Default,
  args: {
    organization: org,
    repository: { ...repo, license: undefined, stars: 0 },
    issues: [issue, issue, issue, issue, issue, issue],
  },
}
