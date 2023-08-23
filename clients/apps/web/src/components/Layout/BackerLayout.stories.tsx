import type { Meta, StoryObj } from '@storybook/react'
import BackerLayout from './BackerLayout'

const meta: Meta<typeof BackerLayout> = {
  title: 'Layouts/BackerLayout',
  component: BackerLayout,
}

export default meta

type Story = StoryObj<typeof BackerLayout>

export const Default: Story = {
  parameters: {
    themes: ['light'],
    padding: 'p-0 m-0',
  },
  render: () => (
    <BackerLayout>
      <div className="bg-red-200 text-black">Content</div>
    </BackerLayout>
  ),
}

export const Dark: Story = {
  ...Default,
  parameters: {
    themes: ['dark'],
    padding: 'p-0',
  },
}
