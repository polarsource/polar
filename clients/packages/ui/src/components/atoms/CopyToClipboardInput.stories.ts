import type { Meta, StoryObj } from '@storybook/react'
import CopyToClipboardInput from './CopyToClipboardInput'

const meta: Meta<typeof CopyToClipboardInput> = {
  title: 'Atoms/CopyToClipboardInput',
  component: CopyToClipboardInput,
}

export default meta

type Story = StoryObj<typeof CopyToClipboardInput>

export const Default: Story = {
  args: {
    value: 'Hello this is something that you can copy',
    id: 'x',
  },
}
