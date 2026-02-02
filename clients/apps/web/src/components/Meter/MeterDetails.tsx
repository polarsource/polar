'use client'

import { schemas } from '@spaire/client'
import FormattedDateTime from '@spaire/ui/components/atoms/FormattedDateTime'
import CopyToClipboardButton from '../CopyToClipboardButton/CopyToClipboardButton'
import { DetailRow } from '../Shared/DetailRow'
import { toast } from '../Toast/use-toast'

export const MeterDetails = ({ meter }: { meter: schemas['Meter'] }) => {
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
        label="Aggregation Type"
        value={meter.aggregation.func}
        valueClassName="capitalize"
      />
      <DetailRow
        label="Created At"
        value={<FormattedDateTime datetime={meter.created_at} />}
      />
    </div>
  )
}
