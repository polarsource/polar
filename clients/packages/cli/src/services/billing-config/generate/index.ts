import type { Generator } from '@/services/billing-config/generate/contract'
import { python } from '@/services/billing-config/generate/python'

export const GENERATORS = { py: python } satisfies Record<string, Generator>

export type GeneratedLanguage = keyof typeof GENERATORS

export const GENERATED_LANGUAGES = Object.keys(
  GENERATORS,
) as ReadonlyArray<GeneratedLanguage>
