import type { Meta, StoryObj } from '@storybook/react'
import ShadowBox from './ShadowBox'

const meta: Meta<typeof ShadowBox> = {
  title: 'Atoms/ShadowBox',
  component: ShadowBox,
}

export default meta

type Story = StoryObj<typeof ShadowBox>

export const Default: Story = {
  args: {},
  render: (args) => {
    return (
      <div className="w-fit">
        <ShadowBox {...args}>
          <span>Look! I am a box!</span>
        </ShadowBox>
      </div>
    )
  },
}
