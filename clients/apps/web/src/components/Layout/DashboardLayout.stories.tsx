import { repo } from '@/stories/testdata'
import type { Meta, StoryObj } from '@storybook/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from 'polarkit'
import BackerLayout from './BackerLayout'
import DashboardLayout, {
  DashboardBody,
  DashboardHeader,
  RepoPickerHeader,
} from './DashboardLayout'

const meta: Meta<typeof DashboardLayout> = {
  title: 'Layouts/DashboardLayout',
  component: BackerLayout,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
}

export default meta

type Story = StoryObj<typeof DashboardLayout>

export const Default: Story = {
  parameters: {
    themes: ['light'],
    padding: 'p-0 m-0',
  },
  render: (args) => (
    <QueryClientProvider client={queryClient}>
      <DashboardLayout {...args}>
        <DashboardBody>
          <div className="bg-red-200 text-black">Content</div>
        </DashboardBody>
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

export const Header: Story = {
  ...Default,
  args: {
    ...Default.args,
  },
  parameters: {
    themes: ['light'],
    padding: 'p-0',
  },
  render: (args) => {
    return (
      <QueryClientProvider client={queryClient}>
        <DashboardLayout {...args}>
          <DashboardHeader>
            <div className="bg-blue-200">Hello from header</div>,
          </DashboardHeader>
        </DashboardLayout>
      </QueryClientProvider>
    )
  },
}

export const RepoPicker: Story = {
  ...Default,
  args: {
    ...Default.args,
  },
  parameters: {
    themes: ['light'],
    padding: 'p-0',
  },
  render: (args) => {
    return (
      <QueryClientProvider client={queryClient}>
        <DashboardLayout {...args}>
          <DashboardHeader>
            <RepoPickerHeader currentRepository={repo} repositories={[repo]}>
              <input
                type="text"
                name="query"
                id="query"
                className="block w-full rounded-md border-0 bg-transparent py-2 text-gray-900  placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 sm:text-sm sm:leading-6"
                placeholder="Example"
              />
            </RepoPickerHeader>
          </DashboardHeader>
        </DashboardLayout>
      </QueryClientProvider>
    )
  },
}
