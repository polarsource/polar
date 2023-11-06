import type { Meta, StoryObj } from '@storybook/react'

const Wrapper = (props: {
  isDarkmode: boolean
  amount: number
  fundingGoal: boolean
  upfrontSplit: boolean
}) => {
  let src = `http://localhost:3000/api/github/zegloforko/polarforkotest/issues/4/pledge-injected.svg?amount=${props.amount}`
  if (props.isDarkmode) {
    src += '&darkmode=true'
  }
  if (props.fundingGoal) {
    src += '&fundingGoal=true'
  }
  if (props.upfrontSplit) {
    src += '&upfrontSplit=true'
  }

  return (
    <div className="m-8 mx-auto max-w-[600px] space-y-2 rounded-md border-2 p-2">
      <p>
        Fusce consectetur lectus enim, vitae euismod dolor ultrices vitae. Duis
        magna eros, gravida nec odio quis, bibendum pulvinar ligula. Aenean et
        purus egestas, tristique leo eget, pulvinar nisi. Integer eget lectus
        erat. Vivamus cursus ipsum nibh, ac mattis arcu ultrices vitae.
      </p>

      <img src={src} />
    </div>
  )
}

const meta: Meta<typeof Wrapper> = {
  title: 'Organisms/PledgeBadgeSVG',
  component: Wrapper,
  tags: ['autodocs'],
  args: {
    amount: 4200,
    isDarkmode: false,
  },
}

export default meta

type Story = StoryObj<typeof Wrapper>

export const Default: Story = {
  args: {
    amount: 123000,
  },
}

export const Dark: Story = {
  args: {
    amount: 123000,
    isDarkmode: true,
  },
}

export const NoAmount: Story = {
  args: {
    amount: 0,
  },
}

export const FundingGoal: Story = {
  args: {
    fundingGoal: true,
  },
}

export const FundingGoalDark: Story = {
  args: {
    fundingGoal: true,
    isDarkmode: true,
  },
}

export const FundingGoalUpfront: Story = {
  args: {
    fundingGoal: true,
    upfrontSplit: true,
  },
}
