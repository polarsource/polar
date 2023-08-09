import { SeeksFundingShield } from '@/components/Embed/SeeksFundingShield'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof SeeksFundingShield> = {
  title: 'Organisms/SeeksFundingShield',
  component: SeeksFundingShield,
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
        <SeeksFundingShield {...args} />
      </div>
    )
  },
}

export default meta

type Story = StoryObj<typeof SeeksFundingShield>

export const Default: Story = {
  args: {},
}
