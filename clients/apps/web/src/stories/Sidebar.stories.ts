import type { Meta, StoryObj } from '@storybook/react'

import { DefaultFilters } from 'components/Dashboard'
import { DashboardFilters } from 'components/Dashboard/filters'
import { IssueListType } from 'polarkit/api/client'
import Sidebar from '../components/Dashboard/Sidebar'

let filters = { ...DefaultFilters }

const meta: Meta<typeof Sidebar> = {
  title: 'Organisms/Sidebar',
  component: Sidebar,
  args: {
    filters: filters,
    showTabs: [IssueListType.ISSUES, IssueListType.DEPENDENCIES],
    onSetFilters: (f: DashboardFilters) => {
      filters = f
    },
  },
}

export default meta

type Story = StoryObj<typeof Sidebar>

export const Default: Story = {}
