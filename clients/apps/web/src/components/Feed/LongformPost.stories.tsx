import type { Meta, StoryObj } from '@storybook/react'
import { article } from 'polarkit/testdata'
import LongformPost from './LongformPost'

const meta: Meta<typeof LongformPost> = {
  title: 'Organisms/LongformPost',
  component: LongformPost,
}

export default meta

type Story = StoryObj<typeof LongformPost>

export const Default: Story = {
  args: {
    article: article,
    showPaywalledContent: true,
    isSubscriber: false,
    hasPaidArticlesBenefit: true,
    animation: false,
    showShare: false,
  },
}

export const IsFreeSubscriber: Story = {
  args: {
    ...Default.args,
    isSubscriber: true,
    hasPaidArticlesBenefit: false,
  },
}

export const IsPaidSubscriber: Story = {
  args: {
    ...Default.args,
    isSubscriber: true,
    hasPaidArticlesBenefit: true,
  },
}
