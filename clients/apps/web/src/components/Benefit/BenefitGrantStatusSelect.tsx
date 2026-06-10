import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@polar-sh/orbit'
import React from 'react'

export type BenefitGrantStatusFilter = 'any' | 'granted' | 'revoked'

const benefitGrantStatusDisplayNames: {
  [key in Exclude<BenefitGrantStatusFilter, 'any'>]: string
} = {
  granted: 'Granted',
  revoked: 'Revoked',
}

interface BenefitGrantStatusSelectProps {
  statuses: Exclude<BenefitGrantStatusFilter, 'any'>[]
  value: BenefitGrantStatusFilter
  onChange: (value: BenefitGrantStatusFilter) => void
}

const BenefitGrantStatusSelect: React.FC<BenefitGrantStatusSelectProps> = ({
  statuses,
  value,
  onChange,
}) => {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as BenefitGrantStatusFilter)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a status" translate="no" />
      </SelectTrigger>
      <SelectContent translate="no">
        <SelectItem value="any">
          <span className="whitespace-nowrap">Any status</span>
        </SelectItem>
        <SelectSeparator />
        {statuses.map((status) => (
          <React.Fragment key={status}>
            <SelectGroup>
              <SelectItem value={status}>
                <div>{benefitGrantStatusDisplayNames[status]}</div>
              </SelectItem>
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}

export default BenefitGrantStatusSelect
