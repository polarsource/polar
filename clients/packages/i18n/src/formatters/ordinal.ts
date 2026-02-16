import { DEFAULT_LOCALE, type AcceptedLocale } from '../config'
import { getTranslationLocale, getTranslations } from '../index'

const rulesCache = new Map<string, Intl.PluralRules>()

function getPluralRules(locale: AcceptedLocale): Intl.PluralRules {
  const resolved = getTranslationLocale(locale)
  let rules = rulesCache.get(resolved)
  if (!rules) {
    rules = new Intl.PluralRules(resolved, { type: 'ordinal' })
    rulesCache.set(resolved, rules)
  }
  return rules
}

export function formatOrdinal(
  number: number,
  locale: AcceptedLocale = DEFAULT_LOCALE,
): string {
  const rules = getPluralRules(locale)
  const category = rules.select(number)
  const t = getTranslations(locale)
  const entry = t.ordinal[category as keyof typeof t.ordinal] ?? t.ordinal.other
  const suffix =
    typeof entry === 'object' && 'value' in entry ? entry.value : entry
  return `${number}${suffix}`
}
