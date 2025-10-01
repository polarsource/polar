import { schemas } from '@polar-sh/client'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import ShadowBox from '@polar-sh/ui/components/atoms/ShadowBox'
import { twMerge } from 'tailwind-merge'

export interface LicenseKeyDetails {
  className?: string
  licenseKey: schemas['LicenseKeyRead']
}

export const LicenseKeyDetails = ({
  className,
  licenseKey,
}: LicenseKeyDetails) => {
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
            <span className="dark:text-polar-500 text-gray-500">Status</span>
            <span className="capitalize">{licenseKey.status}</span>
          </div>
          {licenseKey.limit_usage && (
            <div className="flex flex-row items-center justify-between">
              <span className="dark:text-polar-500 text-gray-500">Usage</span>
              <span>
                {licenseKey.usage} / {licenseKey.limit_usage}
              </span>
            </div>
          )}
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Validations
            </span>
            <span>{licenseKey.validations}</span>
          </div>
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Validated At
            </span>
            <span>
              {licenseKey.last_validated_at ? (
                <FormattedDateTime
                  datetime={licenseKey.last_validated_at ?? ''}
                />
              ) : (
                <span>Never Validated</span>
              )}
            </span>
          </div>
          <div className="flex flex-row items-center justify-between">
            <span className="dark:text-polar-500 text-gray-500">
              Expiry Date
            </span>
            <span>
              {licenseKey.expires_at ? (
                <FormattedDateTime datetime={licenseKey.expires_at ?? ''} />
              ) : (
                <span>No Expiry</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </ShadowBox>
  )
}
