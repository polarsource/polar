import { Effect } from 'effect'
import type { ConfigDocument } from '@/schemas/BillingConfig'
import { dropOptionalNulls } from '@/services/billing-config/languages/language'
import { meterSet } from '@/services/billing-config/languages/python/render/meter'
import { importLine } from '@/services/billing-config/languages/python/render/syntax'

export const renderPython = (document: ConfigDocument) =>
  Effect.gen(function* () {
    const imports = new Set(['Config'])
    const sections = dropOptionalNulls(document)
    const meters = yield* meterSet(sections['meters'] ?? [], imports)
    return [
      importLine(imports),
      '',
      '',
      ...meters,
      '',
      '',
      'config = Config(meters=Meters)',
      '',
    ].join('\n')
  })
