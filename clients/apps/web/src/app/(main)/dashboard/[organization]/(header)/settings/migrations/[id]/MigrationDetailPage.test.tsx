import { schemas } from '@polar-sh/client'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { useMerchantMigration } = vi.hoisted(() => ({
  useMerchantMigration: vi.fn(),
}))

vi.mock('@/hooks/queries/merchantMigrations', () => ({
  useMerchantMigration,
  usePanTransfer: () => ({ data: null, isLoading: false }),
}))

vi.mock('@/components/Layout/DashboardLayout', () => ({
  DashboardBody: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock('@polar-sh/orbit', () => ({
  Alert: ({ title }: { title: string }) => <div>{title}</div>,
  Spinner: () => <div>Loading</div>,
  Status: ({ status }: { status: string }) => <span>{status}</span>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('@polar-sh/orbit/Box', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))

vi.mock('../switch/SwitchPanel', () => ({
  SwitchPanel: () => <div>Switch subscriptions</div>,
}))

vi.mock('../review/ReviewTable', () => ({
  ReviewTable: () => <div>Review table</div>,
}))

vi.mock('../ImportedStep', () => ({
  ImportedStep: () => <div>Imported step</div>,
}))

vi.mock('../PrecheckPanel', () => ({
  PrecheckPanel: () => <div>Precheck panel</div>,
}))

vi.mock('../cards/PanTransferPanel', () => ({
  PanTransferPanel: () => <div>Card movement</div>,
}))

vi.mock('../MigrationStepper', () => ({
  MigrationStepper: () => <div>Stepper</div>,
}))

vi.mock('../StripeMark', () => ({
  StripeMark: () => <div>Stripe</div>,
}))

import MigrationDetailPage from './MigrationDetailPage'

function migration(
  step: schemas['MerchantMigrationStep'],
): schemas['MerchantMigration'] {
  return {
    id: 'mig_1',
    created_at: '2026-01-01T00:00:00Z',
    modified_at: null,
    organization_id: 'org_1',
    source_platform: 'stripe',
    step,
    source_connected: true,
    source: { stripe_user_id: 'acct_1', livemode: true },
    operation: null,
  } as schemas['MerchantMigration']
}

const organization = { slug: 'pepy' } as schemas['Organization']

describe('MigrationDetailPage', () => {
  beforeEach(() => {
    useMerchantMigration.mockReset()
  })

  it('shows Switch while Polar is activating subscriptions', () => {
    useMerchantMigration.mockReturnValue({
      data: migration('activate_subscriptions'),
      isLoading: false,
      isError: false,
    })

    render(
      <MigrationDetailPage organization={organization} migrationId="mig_1" />,
    )

    expect(screen.getByText('Switch subscriptions')).toBeTruthy()
    expect(screen.queryByText('Completed')).toBeNull()
  })

  it('shows Completed once the merchant is at cleanup', () => {
    useMerchantMigration.mockReturnValue({
      data: migration('cleanup'),
      isLoading: false,
      isError: false,
    })

    render(
      <MigrationDetailPage organization={organization} migrationId="mig_1" />,
    )

    expect(screen.getByText('Completed')).toBeTruthy()
    expect(
      screen.getByText(/Billing for the switched subscriptions/),
    ).toBeTruthy()
    expect(screen.queryByText('Switch subscriptions')).toBeNull()
  })
})
