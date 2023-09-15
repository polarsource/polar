import type { Meta, StoryObj } from '@storybook/react'
import { ShadowListGroup } from '.'

const meta: Meta<typeof ShadowListGroup> = {
  title: 'Atoms/ShadowListGroup',
  component: ShadowListGroup,
}

export default meta

type Story = StoryObj<typeof ShadowListGroup>

export const Default: Story = {
  args: {},
  render: (args) => {
    return (
      <ShadowListGroup {...args}>
        <ShadowListGroup.Item>Item 1</ShadowListGroup.Item>
        <ShadowListGroup.Item>Item 2</ShadowListGroup.Item>
        <ShadowListGroup.Item>Item 3</ShadowListGroup.Item>
        <ShadowListGroup.Item>Item 4</ShadowListGroup.Item>
      </ShadowListGroup>
    )
  },
}
