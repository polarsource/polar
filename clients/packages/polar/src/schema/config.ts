import { Schema } from 'effect'
import { MeterConfig } from './meter'

export const PolarConfig = Schema.Struct({
  meters: Schema.Array(MeterConfig),
})

export type PolarConfig = typeof PolarConfig.Type
