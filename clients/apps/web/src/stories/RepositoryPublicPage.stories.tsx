import { PolarQueryClientProvider } from '@/app/providers'
import PublicLayout from '@/components/Layout/PublicLayout'
import RepositoryPublicPage from '@/components/Organization/RepositoryPublicPage'
import type { Meta, StoryObj } from '@storybook/react'
import { issueFunding, org, repo } from 'polarkit/testdata'

const meta: Meta<typeof RepositoryPublicPage> = {
  title: 'Pages/RepositoryPublicPage',
  component: RepositoryPublicPage,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
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
    repositories: [repo],
    totalIssueCount: 4,
    issuesFunding: [issueFunding, issueFunding, issueFunding, issueFunding],
  },
  render: (args) => {
    return (
      <PolarQueryClientProvider>
        <PublicLayout>
          <RepositoryPublicPage {...args} />
        </PublicLayout>
      </PolarQueryClientProvider>
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
    ...Default.args,
    organization: org,
    repository: {
      ...repo,
      description: undefined,
    },
  },
}

export const WithoutBioAndLicense: Story = {
  ...Default,
  args: {
    ...Default.args,
    repository: {
      ...repo,
      description: undefined,
      license: undefined,
      stars: 0,
    },
  },
}

export const WithoutBioAndLicenseAndLink: Story = {
  ...Default,
  args: {
    ...Default.args,
    repository: {
      ...repo,
      description: undefined,
      license: undefined,
      stars: 0,
      homepage: undefined,
    },
  },
}
