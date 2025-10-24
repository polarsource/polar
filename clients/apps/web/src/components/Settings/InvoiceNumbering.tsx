'use client'

import { schemas } from '@polar-sh/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@polar-sh/ui/components/atoms/Select'

const INVOICE_NUMBERING_LABELS: Record<schemas['InvoiceNumbering'], string> = {
  organization: 'Organization',
  customer: 'Customer',
}

export interface InvoiceNumberingProps {
  value: schemas['InvoiceNumbering']
  onValueChange: (value: string) => void
}

export const InvoiceNumbering: React.FC<InvoiceNumberingProps> = ({
  value,
  onValueChange,
  ...props
}) => {
  return (
    <Select {...props} value={value} onValueChange={onValueChange}>
      <SelectTrigger>{INVOICE_NUMBERING_LABELS[value]}</SelectTrigger>
      <SelectContent>
        {Object.entries(INVOICE_NUMBERING_LABELS).map(([key, label]) => (
          <SelectItem value={key} key={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
