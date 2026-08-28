import { cleanup, render, screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LicenseKeyBenefitGrant } from './LicenseKeyBenefitGrant'

vi.mock('@/hooks/queries/customerPortal', () => ({
  useCustomerLicenseKey: () => ({
    data: {
      id: 'license-key-id',
      key: 'polar_license_key',
      status: 'granted',
    },
    isLoading: false,
  }),
  useCustomerLicenseKeyRotate: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}))

vi.mock('@/components/Modal/ConfirmModal', () => ({
  ConfirmModal: () => null,
}))

vi.mock('@/components/Toast/use-toast', () => ({
  toast: vi.fn(),
}))

vi.mock('@polar-sh/i18n', () => ({
  DEFAULT_LOCALE: 'en',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
}))

vi.mock('@polar-sh/ui/components/atoms/CopyToClipboardInput', () => ({
  default: () => null,
}))

vi.mock('./LicenseKeyActivations', () => ({
  LicenseKeyActivations: () => null,
}))

vi.mock('./LicenseKeyDetails', () => ({
  LicenseKeyDetails: () => null,
}))

const benefitGrant = {
  properties: {
    license_key_id: 'license-key-id',
  },
}

afterEach(cleanup)

describe('LicenseKeyBenefitGrant', () => {
  it('shows rotation by default', () => {
    render(
      <LicenseKeyBenefitGrant
        api={{} as never}
        benefitGrant={benefitGrant as never}
      />,
    )

    expect(screen.getByRole('button', { name: 'Rotate' })).toBeTruthy()
  })

  it('hides rotation when disabled by the checkout flow', () => {
    render(
      <LicenseKeyBenefitGrant
        api={{} as never}
        benefitGrant={benefitGrant as never}
        allowRotation={false}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Rotate' })).toBeNull()
  })
})
