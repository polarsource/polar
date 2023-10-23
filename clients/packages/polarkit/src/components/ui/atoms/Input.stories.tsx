import { FaceOutlined } from '@mui/icons-material'
import type { Meta, StoryObj } from '@storybook/react'
import Input from './Input'

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
}

export default meta

type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    id: 'x',
    name: 'xx',
    value: 133700,
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <Input {...args} />
      </div>
    )
  },
}

export const WithPlaceholder: Story = {
  args: {
    id: 'x',
    name: 'xx',
    placeholder: 'This is an input',
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <Input {...args} />
      </div>
    )
  },
}

export const WithIcon: Story = {
  args: {
    id: 'x',
    name: 'xx',
    placeholder: 'This is an input',
    preSlot: <FaceOutlined fontSize="small" />,
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <Input {...args} />
      </div>
    )
  },
}
