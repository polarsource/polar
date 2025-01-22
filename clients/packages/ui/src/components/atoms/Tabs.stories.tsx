import type { Meta, StoryObj } from '@storybook/react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs'

const meta: Meta<typeof Tabs> = {
  title: 'Atoms/Tabs',
  component: Tabs,
}

export default meta

type Story = StoryObj<typeof TabsList>

export const Default: Story = {
  args: {
    vertical: false,
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <Tabs defaultValue="first">
          <TabsList {...args}>
            <TabsTrigger value="first">First</TabsTrigger>
            <TabsTrigger value="second">Second</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    )
  },
}

export const WithContent: Story = {
  args: {
    vertical: false,
  },
  render: (args) => {
    return (
      <div className="w-fit">
        <Tabs defaultValue="first">
          <TabsList {...args}>
            <TabsTrigger value="first">First</TabsTrigger>
            <TabsTrigger value="second">Second</TabsTrigger>
          </TabsList>
          <TabsContent value="first">
            Here is some content for first tab
          </TabsContent>
          <TabsContent value="second">
            Here is some content for second tab
          </TabsContent>
        </Tabs>
      </div>
    )
  },
}
