import fs from 'node:fs'
import path from 'node:path'
import * as log from './logger'
import {
  type NestedObject,
  flattenKeysToStrings,
  extractPlaceholders,
  arraysEqual,
} from './utils'

const LOCALES_DIR = path.join(
  import.meta.dirname,
  '../src/locales/generated-translations'
)
const EN_FILE = path.join(import.meta.dirname, '../src/locales/en.json')
const SUPPORTED_LOCALES_FILE = path.join(
  import.meta.dirname,
  '../src/locales/config/supported.json'
)

function validate() {
  const errors: string[] = []

  const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8')) as NestedObject
  const { supportedLocales } = JSON.parse(
    fs.readFileSync(SUPPORTED_LOCALES_FILE, 'utf-8')
  ) as { supportedLocales: string[] }

  const sourceKeys = flattenKeysToStrings(en)
  const targetLocales = supportedLocales.filter((l) => l !== 'en')

  log.header('Polar i18n Validation')
  log.info(`Source: ${log.bold(sourceKeys.size.toString())} keys in en.json`)
  log.info(`Checking: ${targetLocales.map((l) => log.cyan(l)).join(', ')}`)

  for (const locale of targetLocales) {
    const localeFile = path.join(LOCALES_DIR, `${locale}.json`)

    log.localeHeader(locale, locale.toUpperCase())

    if (!fs.existsSync(localeFile)) {
      errors.push(`${locale}: File does not exist`)
      log.error('File does not exist')
      continue
    }

    const translation = JSON.parse(
      fs.readFileSync(localeFile, 'utf-8')
    ) as NestedObject
    const translationKeys = flattenKeysToStrings(translation)

    const missingKeys: string[] = []
    for (const key of sourceKeys.keys()) {
      if (!translationKeys.has(key)) {
        missingKeys.push(key)
      }
    }

    if (missingKeys.length > 0) {
      errors.push(`${locale}: Missing ${missingKeys.length} keys`)
      log.warning(`Missing ${missingKeys.length} key${missingKeys.length > 1 ? 's' : ''}`)
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
      log.warning(`${extraKeys.length} extra key${extraKeys.length > 1 ? 's' : ''}`)
      for (const key of extraKeys) {
        log.item(log.dim(key))
      }
    }

    const placeholderErrors: string[] = []
    for (const [key, sourceValue] of sourceKeys) {
      const translationValue = translationKeys.get(key)
      if (!translationValue) continue

      const sourcePlaceholders = extractPlaceholders(sourceValue)
      const translationPlaceholders = extractPlaceholders(translationValue)

      if (!arraysEqual(sourcePlaceholders, translationPlaceholders)) {
        placeholderErrors.push(key)
        errors.push(
          `${locale}.${key}: Placeholder mismatch`
        )
      }
    }

    if (placeholderErrors.length > 0) {
      log.warning(`${placeholderErrors.length} placeholder mismatch${placeholderErrors.length > 1 ? 'es' : ''}`)
      for (const key of placeholderErrors) {
        log.item(log.dim(key))
      }
    }

    if (missingKeys.length === 0 && extraKeys.length === 0 && placeholderErrors.length === 0) {
      log.success('All keys valid')
    }
  }

  log.blank()

  if (errors.length > 0) {
    log.error(`Validation failed with ${errors.length} error${errors.length > 1 ? 's' : ''}`)
    log.blank()
    process.exit(1)
  }

  log.done('All translations valid')
}

validate()
