import type { Meta, StoryObj } from '@storybook/react'

import LoadingScreen from '../components/Dashboard/LoadingScreen'

const meta: Meta<typeof LoadingScreen> = {
  title: 'Pages/LoadingScreen',
  component: LoadingScreen,
  tags: ['autodocs'],
  args: {
    children: 'Brewing a fresh access token',
  },
}

export default meta

type Story = StoryObj<typeof LoadingScreen>

export const Default: Story = {}
