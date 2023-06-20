import type { Meta, StoryObj } from '@storybook/react'
import { IssueListType } from 'polarkit/api/client'
import { DefaultFilters } from '../components/Dashboard'
import Sidebar from '../components/Dashboard/Sidebar'

let filters = { ...DefaultFilters }

const meta: Meta<typeof Sidebar> = {
  title: 'Organisms/Sidebar',
  component: Sidebar,
  args: {
    filters: filters,
    showTabs: [IssueListType.ISSUES, IssueListType.DEPENDENCIES],
    onSetFilters: (f) => {
      filters = f
    },
  },
  parameters: {
    themeLayout: 'side-by-side',
  },
}

export default meta

type Story = StoryObj<typeof Sidebar>

export const Default: Story = {}

export const Dependencies: Story = {
  args: {
    ...Default.args,
    showTabs: [IssueListType.DEPENDENCIES],
  },
}
