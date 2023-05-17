import type { Meta, StoryObj } from '@storybook/react'

import FakePullReqeust from '../components/Settings/FakePullRequest'

// More on how to set up stories at: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
const meta: Meta<typeof FakePullReqeust> = {
  title: 'Settings/FakePullReqeust',
  component: FakePullReqeust,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof FakePullReqeust>

export const Default: Story = {}
