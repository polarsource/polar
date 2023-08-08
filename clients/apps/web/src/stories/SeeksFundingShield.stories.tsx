import { Shield } from '@/components/Embed/SeeksFundingShield'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Shield> = {
  title: 'Organisms/SeeksFundingShield',
  component: Shield,
  // tags: ['autodocs'],
  args: {
    count: 10,
  },
  parameters: {
    themes: ['light'],
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <Shield {...args} />
      </div>
    )
  },
}

export default meta

type Story = StoryObj<typeof Shield>

export const Default: Story = {
  args: {},
}
