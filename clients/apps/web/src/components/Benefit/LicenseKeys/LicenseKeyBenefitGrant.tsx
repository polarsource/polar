import { toast } from '@/components/Toast/use-toast'
import { useCustomerLicenseKey } from '@/hooks/queries'
import { Client, schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import CopyToClipboardInput from '@polar-sh/ui/components/atoms/CopyToClipboardInput'
import { LicenseKeyActivations } from './LicenseKeyActivations'
import { LicenseKeyDetails } from './LicenseKeyDetails'

const LicenseKey = ({
  api,
  licenseKey,
  locale,
}: {
  api: Client
  licenseKey: schemas['LicenseKeyWithActivations']
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)

  if (!licenseKey) {
    return <></>
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
      <LicenseKeyActivations
        api={api}
        licenseKey={licenseKey}
        locale={locale}
      />
    </>
  )
}

export const LicenseKeyBenefitGrant = ({
  api,
  benefitGrant,
  locale,
}: {
  api: Client
  benefitGrant: schemas['CustomerBenefitGrantLicenseKeys']
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)
  const { data: licenseKey, isLoading } = useCustomerLicenseKey(
    api,
    benefitGrant.properties.license_key_id as string,
  )

  if (isLoading) {
    // TODO: Style me
    return <div>{t('checkout.benefits.licenseKey.loading')}</div>
  }

  if (!licenseKey) {
    return <></>
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      <LicenseKey api={api} licenseKey={licenseKey} locale={locale} />
    </div>
  )
}
