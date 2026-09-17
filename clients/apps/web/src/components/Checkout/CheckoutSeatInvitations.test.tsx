import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import {
  createWebCheckout,
  CUSTOMER_SESSION_TOKEN,
  seatBasedCheckout,
  serveCheckout,
} from '@/test-utils/checkout'
import { renderWithProviders } from '@/test-utils/render'
import { apiError } from '@/test-utils/server'
import CheckoutSeatInvitations from './CheckoutSeatInvitations'

const renderInvitations = (
  seats: number,
  { withSession = true }: { withSession?: boolean } = {},
) => {
  const checkout = createWebCheckout(seatBasedCheckout(seats))
  const api = serveCheckout(checkout)
  return {
    api,
    ...renderWithProviders(
      <CheckoutSeatInvitations
        checkout={checkout}
        customerSessionToken={withSession ? CUSTOMER_SESSION_TOKEN : undefined}
      />,
    ),
  }
}

const emailInputs = () => screen.getAllByPlaceholderText('email@example.com')
const seatRequests = (api: ReturnType<typeof serveCheckout>) =>
  api.requests.filter((request) => request.path === '/v1/customer-portal/seats')

describe('CheckoutSeatInvitations', () => {
  it('invites teammates to the remaining seats with the customer session', async () => {
    const { api } = renderInvitations(3)
    expect(screen.getByText(/up to 2 more team members/)).toBeInTheDocument()

    fireEvent.change(emailInputs()[0], {
      target: { value: 'ada@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add another email/i }))
    fireEvent.change(emailInputs()[1], {
      target: { value: 'grace@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 Invitations' }))

    expect(
      await screen.findByText('Successfully assigned 2 seats.'),
    ).toBeInTheDocument()
    expect(seatRequests(api).map((request) => request.body)).toEqual([
      {
        email: 'ada@example.com',
        checkout_id: 'checkout_1',
        immediate_claim: false,
      },
      {
        email: 'grace@example.com',
        checkout_id: 'checkout_1',
        immediate_claim: false,
      },
    ])
    expect(seatRequests(api)[0].authorization).toBe(
      `Bearer ${CUSTOMER_SESSION_TOKEN}`,
    )
    expect(
      screen.queryByRole('button', { name: /send/i }),
    ).not.toBeInTheDocument()
  })

  it('holds the whole batch when one address is malformed', async () => {
    const { api } = renderInvitations(3)

    fireEvent.change(emailInputs()[0], {
      target: { value: 'ada@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add another email/i }))
    fireEvent.change(emailInputs()[1], { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send 1 Invitation' }))

    expect(await screen.findByText('Invalid email format')).toBeInTheDocument()
    expect(seatRequests(api)).toHaveLength(0)
  })

  it('reports a failed invitation without losing the successful ones', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    onTestFinished(() => consoleError.mockRestore())
    const { api } = renderInvitations(3)
    api.onAssignSeat((body) =>
      body.email === 'grace@example.com'
        ? apiError(400, 'SeatAssignmentError', 'No seats left')
        : {},
    )

    fireEvent.change(emailInputs()[0], {
      target: { value: 'ada@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add another email/i }))
    fireEvent.change(emailInputs()[1], {
      target: { value: 'grace@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 Invitations' }))

    expect(
      await screen.findByText('Failed to send invitation'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByText(/Successfully assigned one seat/),
      ).toBeInTheDocument(),
    )
  })

  it('is not offered for single-seat purchases or without a customer session', () => {
    renderInvitations(1)
    renderInvitations(3, { withSession: false })

    expect(screen.queryByText('Invite your team')).not.toBeInTheDocument()
  })
})
