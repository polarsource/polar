import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'
import * as log from './logger'
import {
  type EntryValue,
  type NestedObject,
  type TranslationCache,
  getStringValue,
  flattenKeys,
  flattenKeysToStrings,
  unflattenKeys,
  findChangedKeys,
  findOrphanedKeys,
  prepareForLLM,
  normalizeResponse,
  extractPlaceholders,
  arraysEqual,
} from './utils'

dotenv.config({ path: path.join(import.meta.dirname, '../.env.local') })
dotenv.config({ path: path.join(import.meta.dirname, '../.env') })

const LOCALES_DIR = path.join(import.meta.dirname, '../src/locales')
const CONFIG_DIR = path.join(LOCALES_DIR, 'config')
const EN_FILE = path.join(LOCALES_DIR, 'en.json')
const PROMPT_FILE = path.join(CONFIG_DIR, 'prompt.md')
const LOCKS_FILE = path.join(CONFIG_DIR, 'locks.json')
const SUPPORTED_LOCALES_FILE = path.join(CONFIG_DIR, 'supported.json')
const CACHE_FILE = path.join(CONFIG_DIR, '.cache.json')

const LOCALE_NAMES: Record<string, string> = {
  sv: 'Swedish',
  es: 'Spanish',
  fr: 'French',
  nl: 'Dutch',
}

async function callLLM(
  targetLocale: string,
  sourceStrings: Record<string, { value: string; llmContext?: string }>,
  prompt: string
): Promise<Record<string, string>> {
  const openai = new OpenAI()

  const localeName = LOCALE_NAMES[targetLocale] || targetLocale
  const systemPrompt = prompt
    .replace(/{TARGET_LOCALE}/g, localeName)
    .replace('{EN_JSON}', JSON.stringify(sourceStrings, null, 2))

  log.step(`Calling OpenAI API...`)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt.split('USER')[0].replace('SYSTEM', '').trim(),
      },
      { role: 'user', content: systemPrompt.split('USER')[1].trim() },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error(`Empty response from OpenAI for ${targetLocale}`)
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>
    return normalizeResponse(parsed)
  } catch {
    throw new Error(
      `Invalid JSON response from OpenAI for ${targetLocale}: ${content}`
    )
  }
}

function loadCache(): TranslationCache {
  if (fs.existsSync(CACHE_FILE)) {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')) as TranslationCache
  }
  return {}
}

function saveCache(cache: TranslationCache): void {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2) + '\n')
}

async function translate(
  sourceKeys: Map<string, EntryValue>,
  targetLocales: string[],
  locks: Record<string, string[]>,
  prompt: string,
  cache: TranslationCache
) {
  log.header('Polar i18n')
  log.info(`Source: ${log.bold(sourceKeys.size.toString())} keys in en.json`)
  log.info(`Targets: ${targetLocales.map((l) => log.cyan(l)).join(', ')}`)

  const stats = { translated: 0, skipped: 0, removed: 0 }

  for (const locale of targetLocales) {
    const localeName = LOCALE_NAMES[locale] || locale
    log.localeHeader(locale, localeName)

    const localeFile = path.join(
      LOCALES_DIR,
      'generated-translations',
      `${locale}.json`
    )
    const lockedKeys = locks[locale] ?? []
    const localeCache = cache[locale] ?? {}

    let existing: NestedObject = {}
    if (fs.existsSync(localeFile)) {
      const content = fs.readFileSync(localeFile, 'utf-8').trim()
      if (content && content !== '{}') {
        existing = JSON.parse(content) as NestedObject
      }
    }

    const changedKeys = findChangedKeys(sourceKeys, localeCache, existing).filter(
      (key) => !lockedKeys.includes(key)
    )

    const orphanedKeys = findOrphanedKeys(sourceKeys, existing)

    if (changedKeys.length === 0 && orphanedKeys.length === 0) {
      log.success('Up to date')
      stats.skipped += sourceKeys.size
      continue
    }

    if (changedKeys.length > 0) {
      log.item(`${changedKeys.length} key${changedKeys.length > 1 ? 's' : ''} to translate`)
    }
    if (orphanedKeys.length > 0) {
      log.item(`${orphanedKeys.length} orphaned key${orphanedKeys.length > 1 ? 's' : ''} to remove`)
    }

    let translations: Record<string, string> = {}
    if (changedKeys.length > 0) {
      const toTranslate = prepareForLLM(sourceKeys, changedKeys)
      translations = await callLLM(locale, toTranslate, prompt)
    }

    const existingFlat = flattenKeys(existing)
    const updatedFlat = new Map<string, string>()

    for (const [key, value] of existingFlat) {
      if (!orphanedKeys.includes(key) && !changedKeys.includes(key)) {
        updatedFlat.set(key, getStringValue(value))
      }
    }

    let translatedCount = 0
    for (const key of changedKeys) {
      if (translations[key]) {
        updatedFlat.set(key, translations[key])
        localeCache[key] = getStringValue(sourceKeys.get(key) as EntryValue)
        translatedCount++
        log.item(`${log.dim(key)}`)
        log.item(`  ${log.gray('en:')} ${getStringValue(sourceKeys.get(key) as EntryValue)}`)
        log.item(`  ${log.cyan(locale + ':')} ${translations[key]}`)
      } else {
        log.warning(`No translation received for "${key}"`)
      }
    }

    for (const key of orphanedKeys) {
      delete localeCache[key]
    }

    cache[locale] = localeCache

    const updated = unflattenKeys(updatedFlat)
    fs.writeFileSync(localeFile, JSON.stringify(updated, null, 2) + '\n')

    stats.translated += translatedCount
    stats.removed += orphanedKeys.length
    stats.skipped += sourceKeys.size - changedKeys.length

    log.success(`Written to ${locale}.json`)
  }

  saveCache(cache)

  log.summary(stats)
}

function validate(
  sourceKeys: Map<string, EntryValue>,
  targetLocales: string[]
): boolean {
  const errors: string[] = []

  log.blank()
  log.step('Validating translations...')

  for (const locale of targetLocales) {
    const localeFile = path.join(
      LOCALES_DIR,
      'generated-translations',
      `${locale}.json`
    )

    if (!fs.existsSync(localeFile)) {
      errors.push(`${locale}: File does not exist`)
      log.error(`${locale}: File does not exist`)
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
      log.warning(`${locale}: Missing ${missingKeys.length} key${missingKeys.length > 1 ? 's' : ''}`)
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
      log.warning(`${locale}: ${extraKeys.length} extra key${extraKeys.length > 1 ? 's' : ''}`)
      for (const key of extraKeys) {
        log.item(log.dim(key))
      }
    }

    const placeholderErrors: string[] = []
    const sourceStrings = flattenKeysToStrings(en)
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
      log.warning(`${locale}: ${placeholderErrors.length} placeholder mismatch${placeholderErrors.length > 1 ? 'es' : ''}`)
      for (const key of placeholderErrors) {
        log.item(log.dim(key))
      }
    }

    if (missingKeys.length === 0 && extraKeys.length === 0 && placeholderErrors.length === 0) {
      log.success(`${locale}: All keys valid`)
    }
  }

  return errors.length === 0
}

let en: NestedObject

async function main() {
  en = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8')) as NestedObject
  const locks = JSON.parse(
    fs.readFileSync(LOCKS_FILE, 'utf-8')
  ) as Record<string, string[]>
  const { supportedLocales } = JSON.parse(
    fs.readFileSync(SUPPORTED_LOCALES_FILE, 'utf-8')
  ) as { supportedLocales: string[] }
  const prompt = fs.readFileSync(PROMPT_FILE, 'utf-8')
  const cache = loadCache()

  const sourceKeys = flattenKeys(en)
  const targetLocales = supportedLocales.filter((l) => l !== 'en')

  await translate(sourceKeys, targetLocales, locks, prompt, cache)

  const isValid = validate(sourceKeys, targetLocales)

  if (!isValid) {
    log.blank()
    log.error('Validation failed')
    process.exit(1)
  }

  log.done('Translation and validation complete')
}

main().catch((error) => {
  log.blank()
  log.error(`Translation failed: ${error.message}`)
  process.exit(1)
})
