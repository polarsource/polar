import en from './locales/en.json'
import es from './locales/generated-translations/es.json'
import fr from './locales/generated-translations/fr.json'
import nl from './locales/generated-translations/nl.json'
import sv from './locales/generated-translations/sv.json'
import type { Messages } from './types'

// Helper to extract value from entries that may have llmContext
function extractValues(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && 'value' in value) {
      // Entry with llmContext - extract just the value
      result[key] = (value as { value: string }).value
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Nested object - recurse
      result[key] = extractValues(value as Record<string, unknown>)
    } else {
      // Plain value
      result[key] = value
    }
  }

  return result
}

// Process English messages (strips llmContext)
const enMessages = extractValues(en as Record<string, unknown>) as unknown as Messages

const messages: Record<string, Messages> = {
  en: enMessages,
  sv: sv as Messages,
  es: es as Messages,
  fr: fr as Messages,
  nl: nl as Messages,
}

function loadLocale(locale: string): Messages {
  return messages[locale] ?? enMessages
}

// Get nested value by dot-notation key
function getByPath(obj: Record<string, unknown>, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)

  if (typeof value !== 'string') {
    console.warn(`Translation key "${path}" not found`)
    return path
  }

  return value
}

/**
 * Create a translator function for server-side use (emails, API responses).
 *
 * @example
 * const t = translations('es')
 * t('checkout.poweredBy') // "Desarrollado por"
 */
function translations(locale: string): (key: string) => string {
  const msgs = loadLocale(locale)
  return (key: string) => getByPath(msgs as unknown as Record<string, unknown>, key)
}

export { enMessages, loadLocale, translations }

export type { Messages }
