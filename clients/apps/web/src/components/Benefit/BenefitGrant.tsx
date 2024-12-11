import {
  CustomerBenefitGrant,
  CustomerBenefitGrantCustom,
  CustomerBenefitGrantDownloadables,
  CustomerBenefitGrantLicenseKeys,
  PolarAPI,
} from '@polar-sh/sdk'
import ShadowBox from 'polarkit/components/ui/atoms/shadowbox'
import { twMerge } from 'tailwind-merge'
import DownloadablesBenefitGrant from './Downloadables/DownloadablesBenefitGrant'
import { LicenseKeyBenefitGrant } from './LicenseKeys/LicenseKeyBenefitGrant'
import { benefitsDisplayNames, resolveBenefitIcon } from './utils'

interface BenefitGrantProps {
  api: PolarAPI
  benefitGrant: CustomerBenefitGrant
}

const BenefitGrantCustom = ({
  benefitGrant,
}: {
  benefitGrant: CustomerBenefitGrantCustom
}) => {
  const {
    benefit: {
      properties: { note },
    },
  } = benefitGrant
  if (!note) {
    return null
  }
  return (
    <ShadowBox className="dark:bg-polar-800 bg-white p-4 text-sm lg:rounded-3xl">
      <p className="whitespace-pre-line">{note}</p>
    </ShadowBox>
  )
}

export const BenefitGrant = ({ api, benefitGrant }: BenefitGrantProps) => {
  const { benefit } = benefitGrant

  return (
    <div className={twMerge('flex w-full flex-col gap-4')}>
      <div className="flex flex-row items-center gap-x-4">
        <div className="flex flex-row items-center gap-x-2 text-xs text-blue-500 dark:text-white">
          <span className="dark:bg-polar-700 flex h-8 w-8 flex-row items-center justify-center rounded-full bg-blue-50 text-sm">
            {resolveBenefitIcon(benefit, 'small')}
          </span>
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-medium capitalize">
            {benefit.description}
          </h3>
          <p className="dark:text-polar-500 flex flex-row gap-x-1 truncate text-sm text-gray-500">
            {benefitsDisplayNames[benefit.type]}
          </p>
        </div>
      </div>
      {benefit.type === 'custom' && (
        <BenefitGrantCustom
          benefitGrant={benefitGrant as CustomerBenefitGrantCustom}
        />
      )}
      {benefit.type === 'downloadables' && (
        <DownloadablesBenefitGrant
          api={api}
          benefitGrant={benefitGrant as CustomerBenefitGrantDownloadables}
        />
      )}
      {benefit.type === 'license_keys' && (
        <LicenseKeyBenefitGrant
          api={api}
          benefitGrant={benefitGrant as CustomerBenefitGrantLicenseKeys}
        />
      )}
    </div>
  )
}
