import type { Meta, StoryObj } from '@storybook/react'

import PublicLayout from '@/components/Layout/PublicLayout'
import PledgeByLink from '@/components/Pledge/PledgeByLink'

const meta: Meta<typeof PledgeByLink> = {
  title: 'Pages/PledgeByLink',
  component: PledgeByLink,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    themes: ['light'],
  },
}

export default meta

type Story = StoryObj<typeof PledgeByLink>

export const Default: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    chromatic: { viewports: [390, 1200] },
  },

  render: (args) => {
    return (
      <PublicLayout showUpsellFooter={true}>
        <PledgeByLink {...args} />
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

export const Error: Story = {
  ...Default,
  args: {
    initLinkValue: 'foobar',
    initErrorMessage: 'This is not a valid link',
  },
}
