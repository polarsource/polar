import path from 'node:path'
import * as log from './logger'
import {
  type NestedObject,
  arraysEqual,
  extractPlaceholders,
  flattenKeys,
  flattenKeysToStrings,
} from './utils'

import { LOCALE_NAMES, SUPPORTED_LOCALES } from '../src/config'

const LOCALES_DIR = path.join(import.meta.dirname, '../src/locales')

async function loadLocale(locale: string): Promise<NestedObject | null> {
  const filePath = path.join(LOCALES_DIR, `${locale}.ts`)
  try {
    const mod = await import(filePath)
    return (mod[locale] ?? null) as NestedObject | null
  } catch {
    return null
  }
}

async function validate() {
  const errors: string[] = []

  const enModule = await import('../src/locales/en.ts')
  const en = enModule.en as NestedObject

  const sourceKeys = flattenKeys(en)
  const sourceStrings = flattenKeysToStrings(en)
  const targetLocales = SUPPORTED_LOCALES.filter((l): l is string => l !== 'en')

  log.header('Polar i18n Validation')
  log.info(`Source: ${log.bold(sourceKeys.size.toString())} keys in en.ts`)
  log.info(`Checking: ${targetLocales.map((l) => log.cyan(l)).join(', ')}`)

  for (const locale of targetLocales) {
    const localeName = LOCALE_NAMES[locale] || locale
    log.localeHeader(locale, localeName)

    const translation = await loadLocale(locale)

    if (!translation) {
      errors.push(`${locale}: File does not exist`)
      log.error('File does not exist')
      continue
    }

    const translationKeys = flattenKeysToStrings(translation)

    const missingKeys: string[] = []
    for (const key of sourceKeys.keys()) {
      if (!translationKeys.has(key)) {
        missingKeys.push(key)
      }
    }

    if (missingKeys.length > 0) {
      errors.push(`${locale}: Missing ${missingKeys.length} keys`)
      log.warning(
        `Missing ${missingKeys.length} key${missingKeys.length > 1 ? 's' : ''}`,
      )
      for (const key of missingKeys) {
        log.item(log.dim(key))
      }
    }

    const extraKeys: string[] = []
    for (const key of translationKeys.keys()) {
      if (!sourceKeys.has(key)) {
        extraKeys.push(key)
      }
    }

    if (extraKeys.length > 0) {
      errors.push(`${locale}: ${extraKeys.length} extra keys`)
      log.warning(
        `${extraKeys.length} extra key${extraKeys.length > 1 ? 's' : ''}`,
      )
      for (const key of extraKeys) {
        log.item(log.dim(key))
      }
    }

    const placeholderErrors: string[] = []
    for (const [key, sourceValue] of sourceStrings) {
      const translationValue = translationKeys.get(key)
      if (!translationValue) continue

      const sourcePlaceholders = extractPlaceholders(sourceValue)
      const translationPlaceholders = extractPlaceholders(translationValue)

      if (!arraysEqual(sourcePlaceholders, translationPlaceholders)) {
        placeholderErrors.push(key)
        errors.push(`${locale}.${key}: Placeholder mismatch`)
      }
    }

    if (placeholderErrors.length > 0) {
      log.warning(
        `${placeholderErrors.length} placeholder mismatch${placeholderErrors.length > 1 ? 'es' : ''}`,
      )
      for (const key of placeholderErrors) {
        log.item(log.dim(key))
      }
    }

    if (
      missingKeys.length === 0 &&
      extraKeys.length === 0 &&
      placeholderErrors.length === 0
    ) {
      log.success('All keys valid')
    }
  }

  log.blank()

  if (errors.length > 0) {
    log.error(
      `Validation failed with ${errors.length} error${errors.length > 1 ? 's' : ''}`,
    )
    log.blank()
    process.exit(1)
  }

  log.done('All translations valid')
}

validate().catch((error) => {
  log.blank()
  log.error(`Validation failed: ${error.message}`)
  process.exit(1)
})
