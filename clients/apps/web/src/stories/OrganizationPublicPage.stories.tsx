import { PolarQueryClientProvider } from '@/app/providers'
import PublicLayout from '@/components/Layout/PublicLayout'
import OrganizationPublicPage from '@/components/Organization/OrganizationPublicPage'
import type { Meta, StoryObj } from '@storybook/react'
import { org, repo } from 'polarkit/testdata'

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
    posts: [],
    organization: orgWithBio,
    repositories: [repo],
    subscriptionTiers: [],
    subscriptionSummary: [],
    onFirstRenderTab: 'overview',
  },
  render: (args) => {
    return (
      <PolarQueryClientProvider>
        <PublicLayout>
          <OrganizationPublicPage {...args} />
        </PublicLayout>
      </PolarQueryClientProvider>
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
