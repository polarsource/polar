import { generateConfig, type PolarConfig } from '@polar-sh/polar'
import { Effect } from 'effect'

export const FORMATS = ['ts', 'json'] as const
export type Format = (typeof FORMATS)[number]

export const DEFAULT_FILES: Record<Format, string> = {
  ts: 'polar.config.ts',
  json: 'polar.config.json',
}

export const formatOf = (file: string): Format | undefined =>
  file.endsWith('.json') ? 'json' : file.endsWith('.ts') ? 'ts' : undefined

const EMPTY: PolarConfig = { meters: [], benefits: [], products: [] }

export const renderConfig = (format: Format) =>
  format === 'ts'
    ? Effect.orDie(generateConfig(EMPTY))
    : Effect.succeed(`${JSON.stringify(EMPTY, null, 2)}\n`)
