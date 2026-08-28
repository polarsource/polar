'use client'

import { ConfirmModal } from '@/components/Modal/ConfirmModal'
import { toast } from '@/components/Toast/use-toast'
import {
  useCustomerLicenseKey,
  useCustomerLicenseKeyRotate,
} from '@/hooks/queries/customerPortal'
import { extractApiErrorMessage } from '@/utils/api/errors'
import { Client, schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import { Button } from '@polar-sh/orbit'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { useCallback, useState } from 'react'
import { LicenseKeyActivations } from './LicenseKeyActivations'
import { LicenseKeyDetails } from './LicenseKeyDetails'

const LicenseKey = ({
  api,
  licenseKey,
  locale = DEFAULT_LOCALE,
  allowRotation,
}: {
  api: Client
  licenseKey: schemas['LicenseKeyWithActivations']
  locale?: AcceptedLocale
  allowRotation: boolean
}) => {
  const t = useTranslations(locale)
  const [showRotateConfirm, setShowRotateConfirm] = useState(false)
  const rotateLicenseKey = useCustomerLicenseKeyRotate(api, licenseKey.id)
  const canRotate =
    licenseKey.status === 'granted' || licenseKey.status === 'disabled'

  const handleRotate = useCallback(async () => {
    if (rotateLicenseKey.isPending) {
      return
    }

    const { error } = await rotateLicenseKey.mutateAsync()
    if (error) {
      toast({
        title: 'License Key Rotation Failed',
        description: extractApiErrorMessage(error),
      })
      return
    }

    toast({
      title: 'License Key Rotated',
      description:
        'The previous key no longer validates. Copy your new key below.',
    })
  }, [rotateLicenseKey])

  if (!licenseKey) {
    return null
  }

  return (
    <>
      <CopyToClipboardInput
        value={licenseKey.key}
        buttonLabel={t('checkout.benefits.licenseKey.copy')}
        onCopy={() => {
          toast({
            title: t('checkout.benefits.licenseKey.copiedToClipboard'),
            description: t(
              'checkout.benefits.licenseKey.copiedToClipboardDescription',
            ),
          })
        }}
      />
      <LicenseKeyDetails licenseKey={licenseKey} locale={locale} />
      {allowRotation && canRotate ? (
        <Button
          variant="secondary"
          onClick={() => setShowRotateConfirm(true)}
          disabled={rotateLicenseKey.isPending}
        >
          Rotate
        </Button>
      ) : null}
      <LicenseKeyActivations
        api={api}
        licenseKey={licenseKey}
        locale={locale}
      />
      <ConfirmModal
        isShown={showRotateConfirm}
        hide={() => setShowRotateConfirm(false)}
        title="Rotate this license key?"
        description="A new key will be generated. The previous key stops validating immediately. Copy the new key after rotating."
        destructive
        destructiveText="Rotate"
        onConfirm={handleRotate}
      />
    </>
  )
}

export const LicenseKeyBenefitGrant = ({
  api,
  benefitGrant,
  locale = DEFAULT_LOCALE,
  allowRotation = true,
}: {
  api: Client
  benefitGrant: schemas['CustomerBenefitGrantLicenseKeys']
  locale?: AcceptedLocale
  allowRotation?: boolean
}) => {
  const t = useTranslations(locale)
  const { data: licenseKey, isLoading } = useCustomerLicenseKey(
    api,
    benefitGrant.properties.license_key_id as string,
  )

  if (isLoading) {
    return <div>{t('checkout.benefits.licenseKey.loading')}</div>
  }

  if (!licenseKey) {
    return null
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      <LicenseKey
        api={api}
        licenseKey={licenseKey}
        locale={locale}
        allowRotation={allowRotation}
      />
    </div>
  )
}
