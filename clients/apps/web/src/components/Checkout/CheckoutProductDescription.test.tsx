import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { triggerResize } from '@/test-utils/viewport'
import { CheckoutProductDescription } from './CheckoutProductDescription'

const DESCRIPTION = Array.from(
  { length: 12 },
  (_, index) => `Paragraph ${index + 1} of the description.`,
).join('\n\n')

const layOut = (scrollHeight: number, clientHeight: number) => {
  const element = document.getElementById('description')!
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  })
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  })
  triggerResize()
}

const renderDescription = () =>
  render(
    <CheckoutProductDescription
      description={DESCRIPTION}
      productName="Pro"
      locale="en"
    />,
  )

describe('CheckoutProductDescription', () => {
  it('offers Read more once the clamped description has been laid out', () => {
    renderDescription()
    expect(
      screen.queryByRole('button', { name: 'Read more' }),
    ).not.toBeInTheDocument()

    layOut(400, 96)

    expect(
      screen.getByRole('button', { name: 'Read more' }),
    ).toBeInTheDocument()
  })

  it('does not offer Read more when the description fits', () => {
    renderDescription()

    layOut(80, 96)

    expect(
      screen.queryByRole('button', { name: 'Read more' }),
    ).not.toBeInTheDocument()
  })

  it('opens the full description when Read more is clicked', () => {
    renderDescription()
    layOut(400, 96)

    fireEvent.click(screen.getByRole('button', { name: 'Read more' }))

    expect(
      screen.getAllByText('Paragraph 12 of the description.').length,
    ).toBeGreaterThan(1)
  })
})
