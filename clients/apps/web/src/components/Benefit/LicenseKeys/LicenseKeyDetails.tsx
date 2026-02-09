import { unreachable } from '@/utils/unreachable'
import { schemas } from '@polar-sh/client'
import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { twMerge } from 'tailwind-merge'

export interface LicenseKeyDetails {
  className?: string
  licenseKey: schemas['LicenseKeyRead']
  locale?: AcceptedLocale
}

const getLicenseKeyStatusLabel = (
  status: schemas['LicenseKeyStatus'],
  t: ReturnType<typeof useTranslations>,
) => {
  switch (status) {
    case 'granted':
      return t('checkout.benefits.licenseKey.statusGranted')
    case 'revoked':
      return t('checkout.benefits.licenseKey.statusRevoked')
    case 'disabled':
      return t('checkout.benefits.licenseKey.statusDisabled')
    default:
      unreachable(status)
  }
}

export const LicenseKeyDetails = ({
  className,
  licenseKey,
  locale,
}: LicenseKeyDetails) => {
  const resolvedLocale = locale ?? DEFAULT_LOCALE
  const t = useTranslations(resolvedLocale)

  return (
    <ShadowBox
      className={twMerge(
        'dark:bg-polar-800 bg-gray-100 p-6 text-sm lg:rounded-2xl',
        className,
      )}
    >
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-y-2">
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {t('checkout.benefits.licenseKey.status')}
            </span>
            <span>{getLicenseKeyStatusLabel(licenseKey.status, t)}</span>
          </div>
          {licenseKey.limit_usage && (
            <div className="flex flex-row items-center justify-between">
              <span className="dark:text-polar-500 text-gray-500">
                {t('checkout.benefits.licenseKey.usage')}
              </span>
              <span>
                {licenseKey.usage} / {licenseKey.limit_usage}
              </span>
            </div>
          )}
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {t('checkout.benefits.licenseKey.validations')}
            </span>
            <span>{licenseKey.validations}</span>
          </div>
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {t('checkout.benefits.licenseKey.validatedAt')}
            </span>
            <span>
              {licenseKey.last_validated_at ? (
                <FormattedDateTime
                  datetime={licenseKey.last_validated_at ?? ''}
                  locale={resolvedLocale}
                />
              ) : (
                <span>{t('checkout.benefits.licenseKey.neverValidated')}</span>
              )}
            </span>
          </div>
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              {t('checkout.benefits.licenseKey.expiryDate')}
            </span>
            <span>
              {licenseKey.expires_at ? (
                <FormattedDateTime
                  datetime={licenseKey.expires_at ?? ''}
                  locale={resolvedLocale}
                />
              ) : (
                <span>{t('checkout.benefits.licenseKey.noExpiry')}</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </ShadowBox>
  )
}
