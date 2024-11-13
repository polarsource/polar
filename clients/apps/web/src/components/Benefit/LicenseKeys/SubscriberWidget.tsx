import {
  BenefitGrantLicenseKeys,
  BenefitLicenseKeysSubscriber,
  LicenseKeyWithActivations,
  UserBenefit,
  UserOrder,
  UserSubscription,
} from '@polar-sh/sdk'

import { useLicenseKey } from '@/hooks/queries'
import CopyToClipboardInput from 'polarkit/components/ui/atoms/copytoclipboardinput'
import { LicenseKeyActivations } from './LicenseKeyActivations'
import { LicenseKeyDetails } from './LicenseKeyDetails'

export const getLicenseKeyGrant = (
  benefit: UserBenefit,
  order?: UserOrder,
  subscription?: UserSubscription,
) => {
  let licenseKeyGrant = undefined
  if (benefit.type === 'license_keys') {
    if (order) {
      licenseKeyGrant = benefit.grants
        .filter((grant) => grant.order_id === order.id)
        .pop()
    } else if (subscription) {
      licenseKeyGrant = benefit.grants
        .filter((grant) => grant.subscription_id === subscription.id)
        .pop()
    }
  }
  return licenseKeyGrant
}

const LicenseKey = ({
  licenseKey,
}: {
  licenseKey: LicenseKeyWithActivations
}) => {
  if (!licenseKey) {
    return <></>
  }

  return (
    <>
      <CopyToClipboardInput value={licenseKey.key} />
      <LicenseKeyDetails licenseKey={licenseKey} />
      <LicenseKeyActivations licenseKeyId={licenseKey.id} />
    </>
  )
}

const LicenseKeysWidget = ({ grant }: { grant: BenefitGrantLicenseKeys }) => {
  const licenseKeyId = grant.properties.license_key_id
  const licenseKeyQuery = useLicenseKey({ licenseKeyId })
  const licenseKey = licenseKeyQuery.data

  if (licenseKeyQuery.isLoading) {
    // TODO: Style me
    return <div>Loading...</div>
  }

  if (!licenseKey) {
    return <></>
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      <LicenseKey licenseKey={licenseKey} />
    </div>
  )
}

export const LicenseKeysSubscriberWidget = ({
  benefit,
  order,
  subscription,
}: {
  benefit: BenefitLicenseKeysSubscriber
  order?: UserOrder
  subscription?: UserSubscription
}) => {
  const licenseKeyGrant = getLicenseKeyGrant(benefit, order, subscription)
  if (!licenseKeyGrant) {
    return <></>
  }

  return <LicenseKeysWidget grant={licenseKeyGrant} />
}
