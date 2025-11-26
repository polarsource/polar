import { formatSubCentCurrency } from '@/utils/formatters'
import { schemas } from '@polar-sh/client'
import { BadgeDollarSignIcon, BotIcon, BracesIcon } from 'lucide-react'
import { EventCardBase } from './EventCardBase'
import { useMetadata } from './UserEventCard'

const DataRow = ({
  label,
  value,
}: {
  label: string
  value: string | number
}) => {
  return (
    <div className="flex flex-row items-center gap-x-4">
      <div className="flex w-48 flex-row items-center gap-x-4">
        <span>{label}</span>
      </div>
      <span className="dark:text-polar-500 text-gray-500">{value}</span>
    </div>
  )
}

export interface LLMInferenceEventCardProps {
  event: schemas['UserEvent']
}

export const LLMInferenceEventCard = ({
  event,
}: LLMInferenceEventCardProps) => {
  const metadataToRender = useMetadata(event)

  const llmMetadata = '_llm' in event.metadata && event.metadata._llm
  const costMetadata = '_cost' in event.metadata && event.metadata._cost

  return (
    <div>
      <EventCardBase className="font-base flex flex-col gap-y-2 p-4 text-sm">
        <span className="-mt-0.5 mb-1 flex flex-row items-center font-mono text-[11px] font-medium tracking-wider text-gray-500 uppercase">
          <BracesIcon className="mr-1.5 inline-block size-4" />
          Metadata
        </span>

        <pre className="font-mono text-xs whitespace-pre-wrap select-text">
          {JSON.stringify(metadataToRender, null, 2)}
        </pre>
      </EventCardBase>

      {llmMetadata && (
        <EventCardBase className="font-base flex flex-col gap-y-2 p-4 text-sm">
          <span className="-mt-0.5 mb-1 flex flex-row items-center font-mono text-[11px] font-medium tracking-wider text-gray-500 uppercase">
            <BotIcon className="mr-1.5 inline-block size-4" />
            LLM
          </span>

          <DataRow label="Vendor" value={llmMetadata.vendor} />
          <DataRow label="Model" value={llmMetadata.model} />
          <DataRow label="Input Tokens" value={llmMetadata.input_tokens} />
          {typeof llmMetadata.cached_input_tokens === 'number' && (
            <DataRow
              label="Cached Input Tokens"
              value={llmMetadata.cached_input_tokens}
            />
          )}
          <DataRow label="Output Tokens" value={llmMetadata.output_tokens} />
          <DataRow label="Total Tokens" value={llmMetadata.total_tokens} />
        </EventCardBase>
      )}
      {costMetadata && (
        <EventCardBase className="font-base flex flex-col gap-y-2 p-4 text-sm">
          <span className="-mt-0.5 mb-1 flex flex-row items-center font-mono text-[11px] font-medium tracking-wider text-gray-500 uppercase">
            <BadgeDollarSignIcon className="mr-1.5 inline-block size-4" />
            Cost
          </span>
          <DataRow
            label="Cost"
            value={formatSubCentCurrency(Number(costMetadata.amount))}
          />
        </EventCardBase>
      )}
    </div>
  )
}
