import { applyEdits, modify } from 'jsonc-parser'
import { record } from '@/utils/billing-config/describe'

export const SETTINGS_KEY = 'generate'

export const rememberedOut = (input: unknown) => {
  const out = record(record(input)?.[SETTINGS_KEY])?.['out']
  return typeof out === 'string' && out !== '' ? out : undefined
}

export const rememberOut = (source: string, out: string) => {
  const indent = /^[ \t]+/m.exec(source)?.[0] ?? '  '
  return applyEdits(
    source,
    modify(source, [SETTINGS_KEY, 'out'], out, {
      formattingOptions: {
        insertSpaces: !indent.startsWith('\t'),
        tabSize: indent.length,
      },
    }),
  )
}
