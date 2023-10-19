import PublicLayout from '@/components/Layout/PublicLayout'
import OrganizationPublicPage from '@/components/Organization/OrganizationPublicPage'
import type { Meta, StoryObj } from '@storybook/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import { issueFunding, org, repo } from 'polarkit/testdata'

const meta: Meta<typeof OrganizationPublicPage> = {
  title: 'Pages/OrganizationPublicPage',
  component: OrganizationPublicPage,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
}

export default meta

type Story = StoryObj<typeof OrganizationPublicPage>

const orgWithBio = {
  ...org,
  bio: "Giving open source maintainers a funded backlog. Currently in Alpha. Let's fix open source funding",
  company: 'Polar Software Inc',
  blog: 'https://polar.sh/',
  location: 'Stockholm, Sweden',
  email: 'help@polar.sh',
  twitter_username: 'polar_sh',
}

export const Default: Story = {
  parameters: {
    chromatic: { viewports: [390, 1200] },
    themes: ['light'],
  },

  args: {
    organization: orgWithBio,
    repositories: [repo],
    totalIssueCount: 4,
    issuesFunding: [issueFunding, issueFunding, issueFunding, issueFunding],
    subscriptionTiers: [],
  },
  render: (args) => {
    return (
      <QueryClientProvider client={queryClient}>
        <PublicLayout>
          <OrganizationPublicPage {...args} />
        </PublicLayout>
      </QueryClientProvider>
    )
  },
}

export const WithoutBio: Story = {
  ...Default,
  args: {
    ...Default.args,
    organization: org,
    repositories: [repo],
  },
}

export const Dark: Story = {
  ...Default,
  parameters: {
    ...Default.parameters,
    themes: ['dark'],
  },
}
