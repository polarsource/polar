'use client'

import { Meter } from '@/app/api/meters/data'
import FormattedDateTime from '@polar-sh/ui/components/atoms/FormattedDateTime'
import CopyToClipboardButton from '../CopyToClipboardButton/CopyToClipboardButton'
import { DetailRow } from '../Shared/DetailRow'
import { toast } from '../Toast/use-toast'

export const MeterDetails = ({ meter }: { meter: Meter }) => {
  return (
    <div className="flex flex-col">
      <DetailRow
        label="ID"
        value={meter.id}
        action={
          <CopyToClipboardButton
            text={meter.id}
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Meter ID was copied to clipboard`,
              })
            }}
          />
        }
      />
      <DetailRow
        label="Name"
        value={meter.name}
        action={
          <CopyToClipboardButton
            text={meter.name}
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Meter Name was copied to clipboard`,
              })
            }}
          />
        }
      />
      <DetailRow
        label="Slug"
        value={meter.slug}
        action={
          <CopyToClipboardButton
            text={meter.slug}
            onCopy={() => {
              toast({
                title: 'Copied To Clipboard',
                description: `Meter Slug was copied to clipboard`,
              })
            }}
          />
        }
      />
      <DetailRow
        label="Aggregation Type"
        value={meter.aggregation_type}
        valueClassName="capitalize"
      />
      <DetailRow
        label="Created At"
        value={<FormattedDateTime datetime={meter.created_at} />}
      />
      <DetailRow
        label="Updated At"
        value={<FormattedDateTime datetime={meter.updated_at} />}
      />
    </div>
  )
}
