import { PolarQueryClientProvider } from '@/app/providers'
import { Controls } from '@/components/Settings/Badge'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Controls> = {
  title: 'Organisms/BadgeRepositoriesControls',
  component: Controls,
  tags: ['autodocs'],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  render: (args) => (
    <PolarQueryClientProvider>
      <Controls {...args} />
    </PolarQueryClientProvider>
  ),
}

export default meta

type Story = StoryObj<typeof Controls>

export const Default: Story = {
  args: {
    showControls: true,
    isRetroactiveEnabled: true,
    retroactiveChanges: {
      xxx: {
        additions: 10,
        removals: 5,
      },
    },
  },
  parameters: {},
}

export const Additions: Story = {
  args: {
    ...Default.args,
    retroactiveChanges: {
      xxx: {
        additions: 10,
        removals: 0,
      },
    },
  },
  parameters: {},
}

export const Removals: Story = {
  args: {
    ...Default.args,
    retroactiveChanges: {
      xxx: {
        additions: 0,
        removals: 14,
      },
    },
  },
  parameters: {},
}

export const SettingsPage: Story = {
  args: {
    showControls: true,
    isRetroactiveEnabled: true,
    retroactiveChanges: {
      xxx: {
        additions: 10,
        removals: 5,
      },
    },
    isSettingPage: true,
  },
  parameters: {},
}

export const SettingsPageChanged: Story = {
  args: {
    showControls: true,
    isRetroactiveEnabled: true,
    retroactiveChanges: {
      xxx: {
        additions: 10,
        removals: 5,
      },
    },
    isSettingPage: true,
    anyBadgeSettingChanged: true,
  },
  parameters: {},
}
