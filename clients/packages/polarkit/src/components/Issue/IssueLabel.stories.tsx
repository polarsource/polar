import type { Meta, StoryObj } from '@storybook/react'
import IssueLabel from './IssueLabel'

const meta: Meta<typeof IssueLabel> = {
  title: 'Issue/IssueLabel',
  component: IssueLabel,
  args: {
    label: {
      name: 'enhancement',
      color: '112233',
    },
  },
}

export default meta

type Story = StoryObj<typeof IssueLabel>

export const Default: Story = {}
