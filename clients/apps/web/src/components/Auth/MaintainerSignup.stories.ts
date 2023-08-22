import type { Meta, StoryObj } from '@storybook/react'
import MaintainerSignup from './MaintainerSignup'

const meta: Meta<typeof MaintainerSignup> = {
  title: 'Organisms/MaintainerSignup',
  component: MaintainerSignup,
}

export default meta

type Story = StoryObj<typeof MaintainerSignup>

export const Default: Story = {
  parameters: {
    themes: ['light'],
  },
}

export const Dark: Story = {
  parameters: {
    themes: ['dark'],
  },
}
