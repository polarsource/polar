import { fireEvent, render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ReviewStatusTabs } from './ReviewStatusTabs'

vi.mock('@polar-sh/orbit', () => ({
  SegmentedControl: ({
    options,
    onChange,
  }: {
    options: { value: string; label: ReactNode }[]
    onChange: (value: string) => void
  }) =>
    options.map((option) => (
      <button key={option.value} onClick={() => onChange(option.value)}>
        {option.label}
      </button>
    )),
}))

describe('ReviewStatusTabs', () => {
  it('separates subscriptions by migration stage', () => {
    const onChange = vi.fn()

    render(
      <ReviewStatusTabs
        value="all"
        counts={{
          all: 58,
          to_prepare: 20,
          ready: 38,
          attention: 0,
          skipped: 0,
        }}
        onChange={onChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'All rows 58' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ready to switch 38' }))
    expect(onChange).toHaveBeenCalledWith('ready')
  })
})
