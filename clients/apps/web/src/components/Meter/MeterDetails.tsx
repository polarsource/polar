import { Meter } from '@/app/api/meters/data'
import { FormattedDateTime } from 'polarkit/components/ui/atoms'
import { twMerge } from 'tailwind-merge'
import CopyToClipboardButton from '../CopyToClipboardButton/CopyToClipboardButton'
import { toast } from '../Toast/use-toast'

export const MeterDetail = ({
  label,
  value,
  valueClassName = '',
  action,
}: {
  label: string
  value: React.ReactNode
  action?: React.ReactNode
  valueClassName?: string
}) => {
  return (
    <div className="flex flex-row items-baseline justify-between gap-x-4 text-sm">
      <h3 className="dark:text-polar-500 flex-1 text-gray-500">{label}</h3>
      <span
        className={twMerge(
          'dark:hover:bg-polar-800 group flex flex-1 flex-row items-center justify-between gap-x-2 rounded-md px-2.5 py-1 transition-colors duration-75 hover:bg-gray-100',
          valueClassName,
        )}
      >
        {value}
        <span className="opacity-0 group-hover:opacity-100">{action}</span>
      </span>
    </div>
  )
}

export const MeterDetails = ({ meter }: { meter: Meter }) => {
  return (
    <div className="flex flex-col">
      <MeterDetail
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
      <MeterDetail
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
      <MeterDetail
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
      <MeterDetail
        label="Aggregation Type"
        value={meter.aggregation_type}
        valueClassName="capitalize"
      />
      <MeterDetail
        label="Created At"
        value={<FormattedDateTime datetime={meter.created_at} />}
      />
      <MeterDetail
        label="Updated At"
        value={<FormattedDateTime datetime={meter.updated_at} />}
      />
    </div>
  )
}
