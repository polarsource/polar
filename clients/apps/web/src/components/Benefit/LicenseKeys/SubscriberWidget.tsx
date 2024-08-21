import { BenefitLicenseKeysSubscriber, LicenseKeyRead } from '@polar-sh/sdk'

import { useLicenseKeys } from '@/hooks/queries'

const LicenseKey = ({ licenseKey }: { licenseKey: LicenseKeyRead }) => {
  return (
    <div>
      <p>{licenseKey.key}</p>
    </div>
  )
}

const LicenseKeysSubscriberWidget = ({
  benefit,
}: {
  benefit: BenefitLicenseKeysSubscriber
}) => {
  const licenseKeyQuery = useLicenseKeys(benefit.organization_id, benefit.id)

  const licenseKeys = licenseKeyQuery.data?.items

  console.log('licenseKeys', licenseKeys)

  if (licenseKeyQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  return (
    <div className="flex w-full flex-col">
      <ul className="flex w-full flex-col gap-y-4">
        {licenseKeys?.map((licenseKey) => (
          <li key={licenseKey.id} className="flex w-full flex-col">
            <LicenseKey licenseKey={licenseKey} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export default LicenseKeysSubscriberWidget
