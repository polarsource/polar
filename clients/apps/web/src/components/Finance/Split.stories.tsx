import { issue, pledgePublicAPI, user } from '@/utils/testdata'
import type { Meta, StoryObj } from '@storybook/react'
import Split, { Contributor } from './Split'

const meta: Meta<typeof Split> = {
  title: 'Organisms/SplitReward',
  component: Split,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof Split>

const contributors: Array<Contributor> = [
  { ...user, username: 'zegl', is_maintainer_org: true },
  {
    ...user,
    username: 'birkjernstrom',
    avatar_url: 'https://avatars.githubusercontent.com/u/281715?v=4',
  },
  {
    ...user,
    username: 'petterheterjag',
    avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
    is_suggested_from_contributions: true,
  },
  {
    ...user,
    username: 'petterheterjag',
    avatar_url: 'https://avatars.githubusercontent.com/u/1426460?v=4',
    is_suggested_from_contributions: true,
  },
]

export const Default: Story = {
  args: {
    pledges: [pledgePublicAPI, pledgePublicAPI, pledgePublicAPI],
    contributors: contributors,
    issue: issue,
    shares: [
      {
        username: 'zegl',
      },
    ],
    onConfirm: () => {},
    onCancel: () => {},
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

export const AdjustedSplit: Story = {
  args: {
    ...Default.args,
    shares: [
      {
        username: 'zegl',
        share_thousands: 400,
        raw_value: '40',
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
        share_thousands: 100,
        raw_value: '10',
      },
      {
        username: 'birkjernstrom',
        share_thousands: 100,
        raw_value: '10',
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
        share_thousands: 800,
        raw_value: '80',
      },
      {
        username: 'birkjernstrom',
        share_thousands: 805,
        raw_value: '80.5',
      },
    ],
  },
}

export const UpfrontSplit: Story = {
  args: {
    ...Default.args,
    issue: { ...issue, upfront_split_to_contributors: 90 },
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
