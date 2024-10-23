import { issue, org, pledgePublicAPI, user } from '@/utils/testdata'
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
    organization: org,
    issue: issue,
    shares: [
      {
        id: '123',
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
        id: '123',
        username: 'zegl',
      },
      {
        id: '456',
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
        id: '123',
        username: 'zegl',
      },
      {
        id: '456',
        username: 'birkjernstrom',
      },
      {
        id: '789',
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
        id: '123',
        username: 'zegl',
        share_thousands: 400,
        raw_value: '40',
      },
      {
        id: '456',
        username: 'birkjernstrom',
      },
      {
        id: '789',
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
        id: '123',
        username: 'zegl',
        share_thousands: 100,
        raw_value: '10',
      },
      {
        id: '456',
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
        id: '123',
        username: 'zegl',
        share_thousands: 800,
        raw_value: '80',
      },
      {
        id: '456',
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
        id: '123',
        username: 'zegl',
      },
      {
        id: '456',
        username: 'birkjernstrom',
      },
      {
        id: '789',
        username: 'petterheterjag',
      },
    ],
  },
}
