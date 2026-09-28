import { schemas } from '@polar-sh/client'
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

export type LicenseKeyStatusFilter = schemas['LicenseKeyStatus'] | 'any'

export const licenseKeyStatusDisplayNames: {
  [key in schemas['LicenseKeyStatus']]: string
} = {
  granted: 'Granted',
  disabled: 'Disabled',
  revoked: 'Revoked',
}

interface LicenseKeyStatusSelectProps {
  statuses: schemas['LicenseKeyStatus'][]
  value: LicenseKeyStatusFilter
  onChange: (value: LicenseKeyStatusFilter) => void
}

const LicenseKeyStatusSelect: React.FC<LicenseKeyStatusSelectProps> = ({
  statuses,
  value,
  onChange,
}) => {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as LicenseKeyStatusFilter)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">
          <span className="whitespace-nowrap">Any status</span>
        </SelectItem>
        <SelectSeparator />
        {statuses.map((status) => (
          <React.Fragment key={status}>
            <SelectGroup>
              <SelectItem value={status}>
                {licenseKeyStatusDisplayNames[status]}
              </SelectItem>
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}

export default LicenseKeyStatusSelect
