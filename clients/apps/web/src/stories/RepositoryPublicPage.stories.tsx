import RepositoryPublicPage from '@/components/Organization/RepositoryPublicPage'
import type { Meta, StoryObj } from '@storybook/react'
import { issue, org, repo } from './testdata'

const meta: Meta<typeof RepositoryPublicPage> = {
  title: 'Pages/RepositoryPublicPage',
  component: RepositoryPublicPage,
  tags: ['autodocs'],
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
}

export const Default: Story = {
  args: {
    organization: orgWithBio,
    repository: repoWithData,
    issues: [issue, issue, issue, issue, issue, issue],
  },
  render: (args) => {
    return (
      <div className="mx-auto mt-12 flex w-full flex-col space-y-12 px-2 md:max-w-[970px] md:px-0">
        <RepositoryPublicPage {...args} />
      </div>
    )
  },
}

export const WithoutBio: Story = {
  ...Default,
  args: {
    organization: org,
    repository: repoWithData,
    issues: [issue, issue, issue, issue, issue, issue],
  },
}
