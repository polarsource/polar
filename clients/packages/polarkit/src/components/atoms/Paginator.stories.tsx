import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import Paginator from './Paginator'

const meta: Meta<typeof Paginator> = {
  title: 'Atoms/Paginator',
  component: Paginator,
}

export default meta

type Story = StoryObj<typeof Paginator>

export const Default: Story = {
  args: {
    totalCount: 100,
    currentPage: 5,
    pageSize: 10,
    siblingCount: 1,
    onPageChange: (page) => console.log(page),
  },
  render: (args) => {
    const [currentPage, setCurrentPage] = useState(args.currentPage)
    return (
      <div className="w-fit">
        <Paginator
          {...args}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>
    )
  },
}
