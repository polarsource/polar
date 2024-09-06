import type { Meta, StoryObj } from '@storybook/react'

import IssueBadge from './IssueBadge'

const meta: Meta<typeof IssueBadge> = {
  title: 'Organisms/IssueBadge',
  component: IssueBadge,
  tags: ['autodocs'],
  args: {
    showAmountRaised: false,
  },
  parameters: {
    themes: ['light'],
  },
}

export default meta

type Story = StoryObj<typeof IssueBadge>

export const Default: Story = {
  args: {
    orgName: 'SerenityOS',
    issueIsClosed: false,
  },
  render: (args) => {
    return (
      <div className="font-sans">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        ></link>

        <IssueBadge {...args} />
        <IssueBadge {...args} darkmode={true} />
      </div>
    )
  },
}

const avatars = [
  'https://avatars.githubusercontent.com/u/1144727?v=4',
  'https://avatars.githubusercontent.com/u/47952?v=4',
  'https://avatars.githubusercontent.com/u/281715?v=4',
  'https://avatars.githubusercontent.com/u/1426460?v=4',
]

export const AmountRaised: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: avatars,
  },
}

export const AmountRaisedSingleAvatar: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: [avatars[0]],
  },
}

export const AmountRaisedFiveAvatars: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: [...avatars, ...avatars].slice(0, 5),
  },
}

export const AmountRaisedTwentyAvatars: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: [
      ...avatars,
      ...avatars,
      ...avatars,
      ...avatars,
      ...avatars,
      ...avatars,
    ].slice(0, 20),
  },
}

export const LargeAmountRaised: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 800000 },
    },
  },
}

export const FundingGoal: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'usd', amount: 12000 },
      pledges_sum: { currency: 'usd', amount: 6000 },
    },
  },
}

export const FundingGoalAvatars: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'usd', amount: 12000 },
      pledges_sum: { currency: 'usd', amount: 6000 },
    },
    avatarsUrls: [...avatars, ...avatars],
  },
}
export const FundingGoalAvatarsVeryWide: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'usd', amount: 1200000000 },
      pledges_sum: { currency: 'usd', amount: 600000000 },
    },
    avatarsUrls: [...avatars, ...avatars],
  },
}

export const FundingGoalZero: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'usd', amount: 12000 },
      pledges_sum: { currency: 'usd', amount: 0 },
    },
  },
}

export const FundingGoalOver: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'usd', amount: 12000 },
      pledges_sum: { currency: 'usd', amount: 3000000 },
    },
  },
}

export const UpfrontSplit: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: false,
    upfront_split_to_contributors: 80,
  },
}

export const UpfrontSplitPledge: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: [...avatars, ...avatars].slice(0, 1),
    upfront_split_to_contributors: 80,
  },
}

export const UpfrontSplitFundingGoal: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      funding_goal: { currency: 'usd', amount: 12000 },
      pledges_sum: { currency: 'usd', amount: 6000 },
    },
    avatarsUrls: [...avatars, ...avatars].slice(0, 1),
    upfront_split_to_contributors: 80,
  },
}

export const UpfrontSplitPledgeLongName: Story = {
  ...Default,
  args: {
    ...Default.args,
    orgName: 'zegloforkozegloforko',
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: [...avatars, ...avatars].slice(0, 1),
    upfront_split_to_contributors: 80,
  },
}

export const UpfrontSplitZero: Story = {
  ...Default,
  args: {
    ...Default.args,
    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: [...avatars, ...avatars].slice(0, 1),
    upfront_split_to_contributors: 0,
  },
}

export const ClosedIssueCanDonate: Story = {
  ...Default,
  args: {
    ...Default.args,
    issueIsClosed: true,
    donationsEnabled: true,

    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: avatars,
    upfront_split_to_contributors: 80,
  },
}

export const ClosedIssue: Story = {
  ...Default,
  args: {
    ...Default.args,

    issueIsClosed: true,
    donationsEnabled: false,

    showAmountRaised: true,
    funding: {
      pledges_sum: { currency: 'usd', amount: 5000 },
    },
    avatarsUrls: avatars,
    upfront_split_to_contributors: 80,
  },
}
