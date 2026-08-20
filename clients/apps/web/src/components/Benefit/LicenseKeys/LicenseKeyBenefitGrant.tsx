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
import { Box } from '@polar-sh/orbit/Box'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { useCallback, useState } from 'react'
import { LicenseKeyActivations } from './LicenseKeyActivations'
import { LicenseKeyDetails } from './LicenseKeyDetails'

const LicenseKey = ({
  api,
  licenseKey,
  locale = DEFAULT_LOCALE,
}: {
  api: Client
  licenseKey: schemas['LicenseKeyWithActivations']
  locale?: AcceptedLocale
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
        title: t('checkout.benefits.licenseKey.rotateFailed'),
        description: extractApiErrorMessage(error),
      })
      return
    }

    toast({
      title: t('checkout.benefits.licenseKey.rotated'),
      description: t('checkout.benefits.licenseKey.rotatedDescription'),
    })
  }, [rotateLicenseKey, t])

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
      {canRotate ? (
        <Box>
          <Button
            variant="secondary"
            onClick={() => {
              if (!rotateLicenseKey.isPending) {
                setShowRotateConfirm(true)
              }
            }}
            disabled={rotateLicenseKey.isPending}
          >
            {t('checkout.benefits.licenseKey.rotate')}
          </Button>
        </Box>
      ) : null}
      <LicenseKeyActivations
        api={api}
        licenseKey={licenseKey}
        locale={locale}
      />
      <ConfirmModal
        isShown={showRotateConfirm}
        hide={() => setShowRotateConfirm(false)}
        title={t('checkout.benefits.licenseKey.rotateConfirmTitle')}
        description={t('checkout.benefits.licenseKey.rotateConfirmDescription')}
        destructive
        destructiveText={t('checkout.benefits.licenseKey.rotate')}
        onConfirm={handleRotate}
      />
    </>
  )
}

export const LicenseKeyBenefitGrant = ({
  api,
  benefitGrant,
  locale = DEFAULT_LOCALE,
}: {
  api: Client
  benefitGrant: schemas['CustomerBenefitGrantLicenseKeys']
  locale?: AcceptedLocale
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
      <LicenseKey api={api} licenseKey={licenseKey} locale={locale} />
    </div>
  )
}
