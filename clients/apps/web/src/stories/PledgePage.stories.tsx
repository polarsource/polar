import type { Meta, StoryObj } from '@storybook/react'

import Pledge from '../components/Pledge'
import { issue, org, repo } from './testdata'

const meta: Meta<typeof Pledge> = {
  title: 'Pages/Pledge',
  component: Pledge,
  args: {
    organization: org,
    repository: repo,
    issue: issue,
  },
}

export default meta

type Story = StoryObj<typeof Pledge>

export const Default: Story = {
  parameters: {
    chromatic: { viewports: [390, 1200] },
  },

  render: (args) => {
    return (
      <div className="mx-auto mt-12 mb-24 flex w-full flex-col gap-12 md:mt-24 md:w-[826px]">
        <Pledge {...args} />
      </div>
    )
  },
}
