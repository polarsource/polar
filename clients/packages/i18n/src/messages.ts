import en from './locales/en.json'
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

// Lazy load other locales
async function loadLocale(locale: string): Promise<Messages> {
  switch (locale) {
    case 'sv':
      return (await import('./locales/generated-translations/sv.json')).default as Messages
    case 'es':
      return (await import('./locales/generated-translations/es.json')).default as Messages
    case 'fr':
      return (await import('./locales/generated-translations/fr.json')).default as Messages
    case 'nl':
      return (await import('./locales/generated-translations/nl.json')).default as Messages
    default:
      return enMessages
  }
}

export { enMessages, loadLocale }

export type { Messages }
