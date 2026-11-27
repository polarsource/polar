import { schemas } from '@polar-sh/client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupportEmailVerifyFlow } from './SupportEmailVerifyFlow'

const status = {
  email: 'support@acme.com',
  verified: false,
  code_pending: false,
}
const sendCode = vi.fn()

vi.mock('@/hooks/queries', () => ({
  useOrganizationEmail: () => ({ data: status }),
  useSendOrganizationEmailCode: () => ({
    mutateAsync: sendCode,
    isPending: false,
  }),
  useVerifyOrganizationEmail: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('@/components/Toast/use-toast', () => ({ toast: vi.fn() }))

const organization = { id: 'org-1' } as schemas['Organization']

describe('SupportEmailVerifyFlow', () => {
  beforeEach(() => {
    // input-otp probes for password manager badges, which jsdom can't lay out.
    document.elementFromPoint = () => null
    status.code_pending = false
    sendCode.mockReset()
    sendCode.mockResolvedValue({ error: undefined })
  })

  it('starts on the send step with the email disabled', () => {
    render(<SupportEmailVerifyFlow organization={organization} />)

    const input = screen.getByLabelText('Support email')
    expect(input).toHaveValue('support@acme.com')
    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument()
  })

  it('offers to update the email only on the send step', () => {
    render(
      <SupportEmailVerifyFlow
        organization={organization}
        updateEmailHref="/dashboard/acme/settings"
      />,
    )
    expect(screen.getByText('Update your support email')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    return waitFor(() =>
      expect(
        screen.queryByText('Update your support email'),
      ).not.toBeInTheDocument(),
    )
  })

  it('opens on the code step while a code is pending', () => {
    status.code_pending = true
    render(<SupportEmailVerifyFlow organization={organization} />)

    expect(screen.getByText(/Enter the code we sent to/)).toBeInTheDocument()
    expect(screen.getByText(/didn't receive my code/)).toBeInTheDocument()
  })

  it('opens on the code step with resend hidden when the code was just sent', () => {
    render(<SupportEmailVerifyFlow organization={organization} codeJustSent />)

    expect(screen.getByText(/Enter the code we sent to/)).toBeInTheDocument()
    expect(screen.queryByText(/didn't receive my code/)).not.toBeInTheDocument()
  })

  it('hides resend right after sending a code', async () => {
    render(<SupportEmailVerifyFlow organization={organization} />)

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() =>
      expect(screen.getByText(/Enter the code we sent to/)).toBeInTheDocument(),
    )
    expect(sendCode).toHaveBeenCalledOnce()
    expect(screen.queryByText(/didn't receive my code/)).not.toBeInTheDocument()
  })
})
