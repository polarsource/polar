import type { Meta, StoryObj } from '@storybook/react'

import OpenGraphImageArticle from '@/components/Organization/OpenGraphImageArticle'
import { article } from 'polarkit/testdata'

const meta: Meta<typeof OpenGraphImageArticle> = {
  title: 'Organisms/OpenGraphImageArticle',
  component: OpenGraphImageArticle,
  parameters: {
    themes: ['light'],
  },
}

export default meta

type Story = StoryObj<typeof OpenGraphImageArticle>

export const Default: Story = {
  args: {
    article: {
      ...article,
    },
  },
  render: (args) => {
    return (
      <div className="absolute">
        <OpenGraphImageArticle {...args} />
      </div>
    )
  },
}

export const LongTitle = {
  ...Default,
  args: {
    ...Default.args,
    article: {
      ...article,
      title:
        'Funding goals, reward contributors (v1), backer dashboard & API Funding goals, reward contributors (v1), backer dashboard & API Funding goals, reward contributors (v1), backer dashboard & API',
    },
  },
}
