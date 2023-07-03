import Split from '@/components/Finance/Split'
import type { Meta, StoryObj } from '@storybook/react'
import { pledge, user } from './testdata'

const meta: Meta<typeof Split> = {
  title: 'Organisms/SplitReward',
  component: Split,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Split>

const contributors = [
  { ...user, username: 'zegl' },
  {
    ...user,
    username: 'birkjernstrom',
    avatar_url: 'https://avatars.githubusercontent.com/u/281715?v=4',
  },
  {
    ...user,
    username: 'petterheterjag',
    avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
  },
]

export const Default: Story = {
  args: {
    pledges: [pledge, pledge, pledge],
    contributors: contributors,
    shares: [
      {
        username: 'zegl',
      },
    ],
  },
}

export const TwoUsers: Story = {
  args: {
    ...Default.args,
    shares: [
      {
        username: 'zegl',
      },
      {
        username: 'birkjernstrom',
      },
    ],
  },
}

export const ThreeUsers: Story = {
  args: {
    ...Default.args,
    shares: [
      {
        username: 'zegl',
      },
      {
        username: 'birkjernstrom',
      },
      {
        username: 'petterheterjag',
      },
    ],
  },
}

export const TwoUsersAdjustedSplit: Story = {
  args: {
    ...Default.args,
    shares: [
      {
        username: 'zegl',
        share: 0.8,
      },
      {
        username: 'birkjernstrom',
      },
    ],
  },
}

export const ThreeUsersAdjustedSplit: Story = {
  args: {
    ...Default.args,
    shares: [
      {
        username: 'zegl',
        share: 0.33,
      },
      {
        username: 'birkjernstrom',
      },
      {
        username: 'petterheterjag',
      },
    ],
  },
}

export const MissingPercentages: Story = {
  args: {
    ...Default.args,
    shares: [
      {
        username: 'zegl',
        share: 0.1,
      },
      {
        username: 'birkjernstrom',
        share: 0.1,
      },
    ],
  },
}

export const TooManyPercentages: Story = {
  args: {
    ...Default.args,
    shares: [
      {
        username: 'zegl',
        share: 0.8,
      },
      {
        username: 'birkjernstrom',
        share: 0.805,
      },
    ],
  },
}
