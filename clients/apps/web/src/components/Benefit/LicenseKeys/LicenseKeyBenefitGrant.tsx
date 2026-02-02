import { toast } from '@/components/Toast/use-toast'
import { useCustomerLicenseKey } from '@/hooks/queries'
import { Client, schemas } from '@spaire/client'
import CopyToClipboardInput from '@spaire/ui/components/atoms/CopyToClipboardInput'
import { LicenseKeyActivations } from './LicenseKeyActivations'
import { LicenseKeyDetails } from './LicenseKeyDetails'

const LicenseKey = ({
  api,
  licenseKey,
}: {
  api: Client
  licenseKey: schemas['LicenseKeyWithActivations']
}) => {
  if (!licenseKey) {
    return <></>
  }

  return (
    <>
      <CopyToClipboardInput
        value={licenseKey.key}
        onCopy={() => {
          toast({
            title: 'Copied To Clipboard',
            description: `License Key was copied to clipboard`,
          })
        }}
      />
      <LicenseKeyDetails licenseKey={licenseKey} />
      <LicenseKeyActivations api={api} licenseKey={licenseKey} />
    </>
  )
}

export const LicenseKeyBenefitGrant = ({
  api,
  benefitGrant,
}: {
  api: Client
  benefitGrant: schemas['CustomerBenefitGrantLicenseKeys']
}) => {
  const { data: licenseKey, isLoading } = useCustomerLicenseKey(
    api,
    benefitGrant.properties.license_key_id as string,
  )

  if (isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  if (!licenseKey) {
    return <></>
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      <LicenseKey api={api} licenseKey={licenseKey} />
    </div>
  )
}
