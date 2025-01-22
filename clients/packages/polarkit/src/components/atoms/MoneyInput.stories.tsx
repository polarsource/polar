import type { Meta, StoryObj } from '@storybook/react'
import MoneyInput from './MoneyInput'

const meta: Meta<typeof MoneyInput> = {
  title: 'Atoms/MoneyInput',
  component: MoneyInput,
}

export default meta

type Story = StoryObj<typeof MoneyInput>

export const Default: Story = {
  args: {
    id: 'x',
    name: 'xx',
    value: 133700,
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <MoneyInput {...args} />
      </div>
    )
  },
}
