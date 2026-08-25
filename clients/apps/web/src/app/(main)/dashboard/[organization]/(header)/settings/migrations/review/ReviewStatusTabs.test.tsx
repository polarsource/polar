import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReviewStatusTabs } from './ReviewStatusTabs'

describe('ReviewStatusTabs', () => {
  it('shows imported and pending subscriptions as separate filters', () => {
    const onChange = vi.fn()

    render(
      <ReviewStatusTabs
        value="all"
        counts={{
          all: 58,
          imported: 27,
          pending: 31,
          attention: 0,
          skipped: 0,
        }}
        onChange={onChange}
      />,
    )

    expect(screen.getByRole('button', { name: 'All rows 58' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Imported 27' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pending 31' }))
    expect(onChange).toHaveBeenCalledWith('pending')
  })
})
