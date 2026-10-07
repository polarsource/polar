import { Data, Schema } from 'effect'

export class TriggerError extends Data.TaggedError('TriggerError')<{
  message: string
  hint?: string
}> {}

export const TriggerEventSchema = Schema.Struct({
  type: Schema.String,
  description: Schema.String,
})
export type TriggerEvent = typeof TriggerEventSchema.Type
