import { AcceptTermsBox } from '@/components/Dashboard/Gatekeeper/AcceptTerms'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof AcceptTermsBox> = {
  title: 'Organisms/Gatekeeper/AcceptTerms',
  component: AcceptTermsBox,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof AcceptTermsBox>

export const Default: Story = {}

export const Loading: Story = {
  args: {
    loading: true,
    acceptedTerms: true,
  },
}

export const Error: Story = {
  args: {
    loading: false,
    acceptedTerms: true,
    showErrorBanner: true,
  },
}
