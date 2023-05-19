import { InviteOnlyBox } from '@/components/Dashboard/Gatekeeper/InviteOnly'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof InviteOnlyBox> = {
  title: 'Organisms/Gatekeeper/InviteOnly',
  component: InviteOnlyBox,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof InviteOnlyBox>

export const Default: Story = {}

export const Disabled: Story = {
  args: {
    joinDisabled: true,
  },
}

export const Loading: Story = {
  args: {
    acceptedTerms: true,
    joinLoading: true,
    joinDisabled: false,
  },
}

export const Error: Story = {
  args: {
    acceptedTerms: true,
    showErrorBanner: true,
    joinDisabled: false,
  },
}
