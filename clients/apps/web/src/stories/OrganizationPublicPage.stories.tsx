import OrganizationPublicPage from '@/components/Organization/OrganizationPublicPage'
import type { Meta, StoryObj } from '@storybook/react'
import { issue, org, repo } from './testdata'

const meta: Meta<typeof OrganizationPublicPage> = {
  title: 'Pages/OrganizationPublicPage',
  component: OrganizationPublicPage,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof OrganizationPublicPage>

const orgWithBio = {
  ...org,
  bio: "Giving open source maintainers a funded backlog. Currently in Alpha. Let's fix open source funding",
  company: 'Polar Software Inc',
  // bio?: string;
  // pretty_name?: string;
  // company?: string;
  blog: 'https://polar.sh/',
  location: 'Stockholm, Sweden',
  email: 'help@polar.sh',
  twitter_username: 'polar_sh',
}

export const Default: Story = {
  args: {
    organization: orgWithBio,
    repositories: [repo],
    issues: [
      {
        ...issue,
        reactions: { ...issue.reactions, plus_one: 1000 },
        comments: 5,
      },
      issue,
      {
        ...issue,
        title:
          'SecretStr comparison fails when field is defined with Field SecretStr comparison fails when field is defined with Field SecretStr comparison fails when field is defined with Field',
        reactions: { ...issue.reactions, plus_one: 0 },
      },
      issue,
      issue,
      issue,
    ],
  },
  render: (args) => {
    return (
      <div className="mx-auto mt-12 flex w-full flex-col space-y-12 px-2 md:max-w-[970px] md:px-0">
        <OrganizationPublicPage {...args} />
      </div>
    )
  },
}

export const WithoutBio: Story = {
  ...Default,
  args: {
    organization: org,
    repositories: [repo],
    issues: [issue, issue, issue, issue, issue, issue],
  },
}
