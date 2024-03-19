import { PolarQueryClientProvider } from '@/app/providers'
import { UserContextProvider } from '@/providers/auth'
import { Meta, StoryObj } from '@storybook/react'
import Topbar from './Topbar'

const meta: Meta<typeof Topbar> = {
  title: 'Organisms/Topbar',
  component: Topbar,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
}

export default meta

type Story = StoryObj<typeof Topbar>

export const Default: Story = {
  parameters: {
    chromatic: { viewports: [390, 1200] },
  },
  render: (args) => (
    <UserContextProvider user={{}}>
      <PolarQueryClientProvider>
        <Topbar {...args} />
      </PolarQueryClientProvider>
    </UserContextProvider>
  ),
}
