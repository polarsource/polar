import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { schemas } from '@polar-sh/client'
import { StartCopyStep } from './StartCopyStep'
import { STEP_COPY, stepCopy } from './panTransferCopy'

vi.mock('@polar-sh/orbit', () => ({
  Alert: ({
    title,
    description,
  }: {
    title: string
    description?: ReactNode
  }) => (
    <div role="alert">
      <strong>{title}</strong>
      {description}
    </div>
  ),
  Button: ({ children, asChild }: { children: ReactNode; asChild?: boolean }) =>
    asChild ? children : <button type="button">{children}</button>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({
    as,
    children,
  }: {
    as?: keyof React.JSX.IntrinsicElements
    children?: ReactNode
  }) => {
    const Tag = as ?? 'div'
    return <Tag>{children}</Tag>
  },
}))

vi.mock('@polar-sh/ui/components/atoms/CopyToClipboardInput', () => ({
  default: ({ value, ariaLabel }: { value: string; ariaLabel?: string }) => (
    <input aria-label={ariaLabel} readOnly value={value} />
  ),
}))

vi.mock('./PanTransferStepForm', () => ({
  PanTransferStepForm: ({ copy }: { copy: { action?: string } }) => (
    <button type="submit">{copy.action}</button>
  ),
}))

const step = {
  key: 'start_copy',
  owner: 'merchant',
  kind: 'input',
  status: 'in_progress',
  inputs: {},
  note: null,
  expected_at: null,
  started_at: null,
  completed_at: null,
  completed_by: null,
} satisfies schemas['PanTransferStep']

describe('StartCopyStep', () => {
  it('names the Stripe page that receives the CSV, then stays on that page', () => {
    render(
      <StartCopyStep
        step={step}
        copy={STEP_COPY.start_copy}
        destinationAccountId="acct_polar"
        migrationId="mig_1"
        source="stripe"
        sourceStripeAccountId="acct_source"
      />,
    )

    const [upload, recipient, returned] = screen.getAllByRole('listitem')

    expect(upload).toHaveTextContent('Upload the customer CSV in Stripe')
    expect(upload).toHaveTextContent(
      'Download it here, then open Stripe → Customers → Copy customers and choose Upload from file under Copy Method.',
    )
    expect(upload).toHaveTextContent('Download CSV')
    expect(upload.querySelector('a')).toHaveAttribute(
      'href',
      'http://api.polar.test/v1/merchant-migrations/mig_1/customer-ids.csv',
    )

    expect(recipient).toHaveTextContent(
      'Paste the Polar account ID as the recipient',
    )
    expect(recipient).toHaveTextContent(
      'On that same page, then start the copy. Only the Stripe account owner can start a copy.',
    )
    expect(recipient).not.toHaveTextContent('Copy customers')
    expect(screen.getByLabelText('Polar account ID')).toHaveValue('acct_polar')

    expect(returned).toHaveTextContent('Come back and paste the migreq id')
    expect(returned).toHaveTextContent('Find it on Stripe copy status.')
    expect(returned).toHaveTextContent('Open Stripe copy status')
    expect(returned.querySelector('a')).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/acct_source/copy-status/shared',
    )

    expect(
      screen.getByRole('button', { name: 'Mark copy started' }),
    ).toBeTruthy()
  })

  it('sends a Lemon Squeezy merchant to request the copy in Lemon Squeezy', () => {
    const copy = stepCopy('request_copy', 'lemon_squeezy')
    expect(copy).toBeDefined()
    render(
      <StartCopyStep
        step={{ ...step, key: 'request_copy', kind: 'confirm' }}
        copy={copy!}
        destinationAccountId="acct_polar"
        migrationId="mig_1"
        source="lemon_squeezy"
      />,
    )

    const [settings, destination] = screen.getAllByRole('listitem')

    expect(settings).toHaveTextContent(
      'Open Settings → Migration in Lemon Squeezy',
    )
    expect(settings.querySelector('a')).toHaveAttribute(
      'href',
      'https://app.lemonsqueezy.com/settings/migration',
    )
    expect(destination).toHaveTextContent(
      'Enter the Polar account ID as the destination Stripe account',
    )
    expect(screen.getByLabelText('Polar account ID')).toHaveValue('acct_polar')
    expect(screen.queryByLabelText('Stripe migration ID')).toBeNull()
    expect(
      screen.getByRole('button', { name: "I've requested the copy" }),
    ).toBeTruthy()
    expect(screen.queryByText('Download CSV')).toBeNull()
  })
})
