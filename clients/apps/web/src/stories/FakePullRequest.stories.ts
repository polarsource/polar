import type { Meta, StoryObj } from '@storybook/react'

import FakePullReqeust from '../components/Settings/FakePullRequest'

const meta: Meta<typeof FakePullReqeust> = {
  title: 'Organisms/FakePullReqeust',
  component: FakePullReqeust,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof FakePullReqeust>

export const Default: Story = {}
