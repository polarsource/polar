import { Data, Schema } from 'effect'
import { PolarEnvironment } from '@/schemas/Auth'

export class SetupRunError extends Data.TaggedError('SetupRunError')<{
  message: string
  hint?: string
}> {}

export const SetupResult = Schema.Struct({
  organization: Schema.String,
  environment: PolarEnvironment,
  instructions: Schema.String,
})
export type SetupResult = typeof SetupResult.Type

export interface SetupStageReport {
  readonly stage: 'connect' | 'analyze' | 'checkout' | 'products'
  readonly status?: 'in_progress' | 'waiting' | 'done'
  readonly note?: string
  readonly url?: string
}
