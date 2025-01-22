import type { Meta, StoryObj } from '@storybook/react'
import { LabeledRadioButton } from '.'

const meta: Meta<typeof LabeledRadioButton> = {
  title: 'Atoms/LabeledRadioButton',
  component: LabeledRadioButton,
}

export default meta

type Story = StoryObj<typeof LabeledRadioButton>

export const Default: Story = {
  args: {
    values: ['Yes', 'No'],
    value: 'Yes',
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <LabeledRadioButton {...args} />
      </div>
    )
  },
}
