import type { Meta, StoryObj } from '@storybook/react'
import TextArea from './TextArea'

const meta: Meta<typeof TextArea> = {
  title: 'Atoms/TextArea',
  component: TextArea,
}

export default meta

type Story = StoryObj<typeof TextArea>

export const Default: Story = {
  args: {
    id: 'x',
    name: 'xx',
    value: 'Hello World!',
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <TextArea {...args} />
      </div>
    )
  },
}

export const WithPlaceholder: Story = {
  args: {
    id: 'x',
    name: 'xx',
    placeholder: 'This is a textarea',
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <TextArea {...args} />
      </div>
    )
  },
}
