import { LoyaltyOutlined } from '@mui/icons-material'
import { BenefitPublicInner, Organization } from '@polar-sh/sdk'
import { Switch } from 'polarkit/components/ui/atoms'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'
import { resolveBenefitIcon } from '../Benefit/utils'

interface BenefitRowProps {
  benefit: BenefitPublicInner
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

const BenefitRow = ({ benefit, checked, onCheckedChange }: BenefitRowProps) => {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-between rounded-xl bg-gray-100 px-4 py-3',
        checked && 'bg-blue-50',
      )}
    >
      <div className="flex flex-row items-center gap-x-4">
        <div
          className={twMerge(
            checked
              ? 'text-blue-500 dark:text-blue-400'
              : 'dark:text-polar-500 text-gray-500',
          )}
        >
          {resolveBenefitIcon(benefit)}
        </div>
        <span
          className={twMerge(
            'text-sm font-medium',
            checked
              ? 'text-blue-500 dark:text-blue-400'
              : 'dark:text-polar-500 text-gray-400',
          )}
        >
          {benefit.description}
        </span>
      </div>
      <div className="flex flex-row items-center gap-x-4 text-[14px]">
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

interface ProductBenefitsSelectorProps {
  organization: Organization
  selectedBenefits: BenefitPublicInner[]
  benefits: BenefitPublicInner[]
  onSelectBenefit: (benefit: BenefitPublicInner) => void
  onRemoveBenefit: (benefit: BenefitPublicInner) => void
  className?: string
}

const ProductBenefitsSelector = ({
  selectedBenefits,
  benefits,
  onSelectBenefit,
  onRemoveBenefit,
  className,
}: ProductBenefitsSelectorProps) => {
  const handleCheckedChange = useCallback(
    (benefit: BenefitPublicInner) => (checked: boolean) => {
      if (checked) {
        onSelectBenefit(benefit)
      } else {
        onRemoveBenefit(benefit)
      }
    },
    [onSelectBenefit, onRemoveBenefit],
  )

  return (
    <>
      <div className={twMerge('flex flex-col gap-y-6', className)}>
        <div className="flex flex-col gap-2">
          <h2 className="dark:text-polar-50 text-sm font-medium text-gray-950">
            Benefits
          </h2>
          <p className="dark:text-polar-500 text-sm text-gray-500">
            Select which benefits you want to grant your customers upon purchase
          </p>
        </div>
        <div className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-2">
              {benefits.length > 0 ? (
                benefits.map((benefit) => (
                  <BenefitRow
                    key={benefit.id}
                    benefit={benefit}
                    checked={selectedBenefits.some((b) => b.id === benefit.id)}
                    onCheckedChange={handleCheckedChange(benefit)}
                  />
                ))
              ) : (
                <div className="dark:text-polar-400 flex flex-col items-center gap-y-6 py-12 text-gray-400">
                  <LoyaltyOutlined fontSize="large" />
                  <h4 className="text-sm">
                    You haven&apos;t configured any benefits yet
                  </h4>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default ProductBenefitsSelector
