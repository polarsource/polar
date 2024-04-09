import type { Meta, StoryObj } from '@storybook/react'
import IssueSummary from './IssueSummary'

import { issue } from 'polarkit/testdata'

const meta: Meta<typeof IssueSummary> = {
  title: 'Issue/IssueSummary',
  component: IssueSummary,
  args: {
    issue,
  },
}

export default meta

type Story = StoryObj<typeof IssueSummary>

export const Default: Story = {}

export const WithLogo: Story = {
  args: {
    ...meta.args,
    showLogo: true,
  },
}

export const WithStatus: Story = {
  args: {
    ...meta.args,
    showStatus: true,
  },
}

export const RightContent: Story = {
  args: {
    ...meta.args,
    right: <div className="fw-bolder">Right content</div>,
  },
}
