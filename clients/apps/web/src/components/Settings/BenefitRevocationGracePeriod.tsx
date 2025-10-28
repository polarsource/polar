'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@polar-sh/ui/components/atoms/Select'

const BENEFIT_REVOCATION_GRACE_PERIOD_LABELS: Record<number, string> = {
  0: 'Immediately',
  2: 'After 2 Days',
  7: 'After 7 Days',
  14: 'After 14 Days',
  21: 'After 21 Days',
}

export interface BenefitRevocationGracePeriodProps {
  value: number
  onValueChange: (value: string) => void
}

export const BenefitRevocationGracePeriod: React.FC<
  BenefitRevocationGracePeriodProps
> = ({ value, onValueChange, ...props }) => {
  return (
    <Select {...props} value={String(value)} onValueChange={onValueChange}>
      <SelectTrigger>
        {BENEFIT_REVOCATION_GRACE_PERIOD_LABELS[value]}
      </SelectTrigger>
      <SelectContent>
        {Object.entries(BENEFIT_REVOCATION_GRACE_PERIOD_LABELS).map(
          ([key, label]) => (
            <SelectItem value={String(key)} key={key}>
              {label}
            </SelectItem>
          ),
        )}
      </SelectContent>
    </Select>
  )
}
