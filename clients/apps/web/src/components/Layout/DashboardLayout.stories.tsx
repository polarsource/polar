import type { Meta, StoryObj } from '@storybook/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import BackerLayout from './BackerLayout'
import DashboardLayout from './DashboardLayout'

const meta: Meta<typeof DashboardLayout> = {
  title: 'Layouts/DashboardLayout',
  component: BackerLayout,
}

export default meta

type Story = StoryObj<typeof DashboardLayout>

export const Default: Story = {
  parameters: {
    themes: ['light'],
    padding: 'p-0 m-0',
  },
  args: {
    showSidebar: false,
  },
  render: (args) => (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout {...args}>
        <div className="bg-red-200 text-black">Content</div>
      </DashboardLayout>
    </QueryClientProvider>
  ),
}

export const Dark: Story = {
  ...Default,
  parameters: {
    themes: ['dark'],
    padding: 'p-0',
  },
}

export const LightSidebar: Story = {
  ...Default,
  args: {
    ...Default.args,
    showSidebar: true,
  },
  parameters: {
    themes: ['light'],
    padding: 'p-0',
  },
}

export const DarkSidebar: Story = {
  ...Default,
  args: {
    ...Default.args,
    showSidebar: true,
  },
  parameters: {
    themes: ['dark'],
    padding: 'p-0',
  },
}

export const Header: Story = {
  ...Default,
  args: {
    ...Default.args,
    showSidebar: true,
    header: <div className="bg-blue-200">Hello from header</div>,
  },
  parameters: {
    themes: ['light'],
    padding: 'p-0',
  },
}
