import { schemas } from '@polar-sh/client'
import { EventCardBase } from './EventCardBase'
import { UserEventCard } from './UserEventCard'

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
  const llmMetadata = '_llm' in event.metadata && event.metadata._llm

  if (!llmMetadata) return <UserEventCard event={event} />

  return (
    <div>
      <UserEventCard event={event} />
      <EventCardBase className="flex flex-col gap-y-2 p-4">
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
    </div>
  )
}
