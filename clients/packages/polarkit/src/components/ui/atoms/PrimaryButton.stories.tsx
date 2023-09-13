import type { Meta, StoryObj } from '@storybook/react'
import { useEffect, useState } from 'react'

import { PrimaryButton } from './PrimaryButton'

const meta: Meta<typeof PrimaryButton> = {
  title: 'Atoms/PrimaryButton',
  component: PrimaryButton,
  tags: ['autodocs'],
}

export default meta

type Story = StoryObj<typeof PrimaryButton>

export const Primary: Story = {
  args: {
    children: 'Click me',
  },
}

export const PrimaryNonFullWidth: Story = {
  args: {
    children: <span>Click me</span>,
    fullWidth: false,
  },
}

export const PrimaryNonFullWidthSizeSmall: Story = {
  args: {
    children: <span>Click me</span>,
    fullWidth: false,
    size: 'small',
  },
}

export const PrimaryLoading: Story = {
  args: {
    children: 'Click me',
    loading: true,
  },
}

export const PrimarySwitchingLoadingState: Story = {
  args: {
    children: 'Click me',
  },
  render: (args) => {
    const [loading, setLoading] = useState(false)

    useEffect(() => {
      let interval = setInterval(() => {
        setLoading(!loading)
      }, 2000)
      return () => {
        clearInterval(interval)
      }
    }, [loading])

    return <PrimaryButton {...args} loading={loading} />
  },
}

export const PrimaryDisabled: Story = {
  args: {
    children: 'Click me',
    disabled: true,
  },
}

export const Blue: Story = {
  args: {
    children: 'Click me',
    color: 'blue',
  },
}

export const Red: Story = {
  args: {
    children: 'Click me',
    color: 'red',
  },
}

export const Green: Story = {
  args: {
    children: 'Click me',
    color: 'green',
  },
}

export const Gray: Story = {
  args: {
    children: 'Click me',
    color: 'gray',
  },
}

export const Lightblue: Story = {
  args: {
    children: 'Click me',
    color: 'lightblue',
  },
}
