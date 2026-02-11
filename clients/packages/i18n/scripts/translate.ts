import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import dotenv from 'dotenv'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as log from './logger'
import {
  type EntryValue,
  type NestedObject,
  type TranslationCache,
  arraysEqual,
  extractPlaceholders,
  findChangedKeys,
  findOrphanedKeys,
  findPluralPaths,
  flattenKeys,
  flattenKeysToStrings,
  getStringValue,
  normalizeResponse,
  prepareForLLM,
  unflattenKeys,
} from './utils'

import {
  DEFAULT_LOCALE,
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
  type TranslatedLocale,
} from '../src/config'

dotenv.config({ path: path.join(import.meta.dirname, '../.env.local') })
dotenv.config({ path: path.join(import.meta.dirname, '../.env') })

const LOCALES_DIR = path.join(import.meta.dirname, '../src/locales')
const CONFIG_DIR = path.join(LOCALES_DIR, 'config')
const PROMPT_FILE = path.join(CONFIG_DIR, 'prompt.md')
const LOCKS_FILE = path.join(CONFIG_DIR, 'locks.json')
const CACHE_FILE = path.join(CONFIG_DIR, '.cache.json')

async function callLLM(
  targetLocale: TranslatedLocale,
  sourceStrings: Record<string, { value: string; _llmContext?: string }>,
  prompt: string,
): Promise<Record<string, string>> {
  const localeName = LOCALE_NAMES[targetLocale] || targetLocale

  const systemPromptPart = prompt
    .split('USER')[0]
    .replace('SYSTEM', '')
    .replace(/{TARGET_LOCALE}/g, localeName)
    .replace('{EN_JSON}', JSON.stringify(sourceStrings, null, 2))
    .trim()

  const userPromptPart = prompt
    .split('USER')[1]
    .replace(/{TARGET_LOCALE}/g, localeName)
    .replace('{EN_JSON}', JSON.stringify(sourceStrings, null, 2))
    .trim()

  log.step(`Calling Gemini 2.5 Flash...`)

  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    system: systemPromptPart,
    prompt: userPromptPart,
    temperature: 0.3,
  })

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    return normalizeResponse(parsed)
  } catch {
    throw new Error(
      `Invalid JSON response from Gemini for ${targetLocale}: ${cleaned}`,
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

function writeLocaleFile(locale: string, obj: NestedObject): void {
  const filePath = path.join(LOCALES_DIR, `${locale}.ts`)
  const content = `export const ${locale} = ${JSON.stringify(obj, null, 2)} as const\n`
  fs.writeFileSync(filePath, content)

  // Run prettier on the generated file
  try {
    execSync(`npx prettier --write "${filePath}"`, {
      stdio: 'pipe',
      cwd: path.join(import.meta.dirname, '..'),
    })
  } catch {
    log.warning(`Prettier formatting failed for ${locale}.ts`)
  }
}

async function loadExistingLocale(
  locale: string,
): Promise<NestedObject | null> {
  const filePath = path.join(LOCALES_DIR, `${locale}.ts`)
  if (!fs.existsSync(filePath)) return null

  try {
    const mod = await import(`${filePath}?t=${Date.now()}`)
    return (mod[locale] ?? null) as NestedObject | null
  } catch {
    log.warning(`Could not import ${locale}.ts`)
    return null
  }
}

/**
 * Seed cache from current source values for locales that already have translations.
 * This prevents re-translating everything on first run when an existing locale file exists.
 */
function seedCacheForLocale(
  locale: string,
  sourceKeys: Map<string, EntryValue>,
  existing: NestedObject,
  cache: TranslationCache,
): void {
  const existingKeys = flattenKeys(existing)
  const localeCache: Record<string, string> = {}

  for (const [key, value] of sourceKeys) {
    if (existingKeys.has(key)) {
      localeCache[key] = getStringValue(value)
    }
  }

  if (Object.keys(localeCache).length > 0) {
    cache[locale] = localeCache
    log.info(`Seeded cache with ${Object.keys(localeCache).length} keys`)
  }
}

async function translate(
  en: NestedObject,
  sourceKeys: Map<string, EntryValue>,
  pluralPaths: Set<string>,
  targetLocales: TranslatedLocale[],
  locks: Record<string, string[]>,
  prompt: string,
  cache: TranslationCache,
) {
  log.header('Polar i18n')
  log.info(`Source: ${log.bold(sourceKeys.size.toString())} keys in en.ts`)
  log.info(`Targets: ${targetLocales.map((l) => log.cyan(l)).join(', ')}`)

  const stats = { translated: 0, skipped: 0, removed: 0 }

  for (const locale of targetLocales) {
    const localeName = LOCALE_NAMES[locale] || locale
    log.localeHeader(locale, localeName)

    const lockedKeys = locks[locale] ?? []
    let localeCache = cache[locale] ?? {}

    const existing = (await loadExistingLocale(locale)) ?? ({} as NestedObject)

    // Seed cache on first run if locale file exists but cache is empty
    if (
      Object.keys(localeCache).length === 0 &&
      Object.keys(existing).length > 0
    ) {
      seedCacheForLocale(locale, sourceKeys, existing, cache)
      localeCache = cache[locale] ?? {}
    }

    const changedKeys = findChangedKeys(
      sourceKeys,
      localeCache,
      existing,
    ).filter((key) => !lockedKeys.includes(key))

    const orphanedKeys = findOrphanedKeys(sourceKeys, existing)

    if (changedKeys.length === 0 && orphanedKeys.length === 0) {
      log.success('Up to date')
      stats.skipped += sourceKeys.size
      continue
    }

    if (changedKeys.length > 0) {
      log.item(
        `${changedKeys.length} key${changedKeys.length > 1 ? 's' : ''} to translate`,
      )
    }
    if (orphanedKeys.length > 0) {
      log.item(
        `${orphanedKeys.length} orphaned key${orphanedKeys.length > 1 ? 's' : ''} to remove`,
      )
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
        log.item(
          `  ${log.gray('en:')} ${getStringValue(sourceKeys.get(key) as EntryValue)}`,
        )
        log.item(`  ${log.cyan(locale + ':')} ${translations[key]}`)
      } else {
        log.warning(`No translation received for "${key}"`)
      }
    }

    for (const key of orphanedKeys) {
      delete localeCache[key]
    }

    cache[locale] = localeCache

    const updated = unflattenKeys(updatedFlat, pluralPaths)
    writeLocaleFile(locale, updated)

    stats.translated += translatedCount
    stats.removed += orphanedKeys.length
    stats.skipped += sourceKeys.size - changedKeys.length

    log.success(`Written to ${locale}.ts`)
  }

  saveCache(cache)

  log.summary(stats)
}

function validate(
  sourceKeys: Map<string, EntryValue>,
  targetLocales: TranslatedLocale[],
  localeData: Map<string, NestedObject>,
): boolean {
  const errors: string[] = []

  log.blank()
  log.step('Validating translations...')

  for (const locale of targetLocales) {
    const translation = localeData.get(locale)

    if (!translation) {
      errors.push(`${locale}: File does not exist`)
      log.error(`${locale}: File does not exist`)
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
        `${locale}: Missing ${missingKeys.length} key${missingKeys.length > 1 ? 's' : ''}`,
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
        `${locale}: ${extraKeys.length} extra key${extraKeys.length > 1 ? 's' : ''}`,
      )
      for (const key of extraKeys) {
        log.item(log.dim(key))
      }
    }

    const sourceStrings = flattenKeysToStrings(
      localeData.get('en') as NestedObject,
    )
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
        `${locale}: ${placeholderErrors.length} placeholder mismatch${placeholderErrors.length > 1 ? 'es' : ''}`,
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
      log.success(`${locale}: All keys valid`)
    }
  }

  return errors.length === 0
}

async function main() {
  // Import source locale
  const enModule = await import('../src/locales/en')
  const en = enModule.en as NestedObject

  const locks = JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf-8')) as Record<
    string,
    string[]
  >
  const prompt = fs.readFileSync(PROMPT_FILE, 'utf-8')
  const cache = loadCache()

  const sourceKeys = flattenKeys(en)
  const pluralPaths = findPluralPaths(en as Record<string, unknown>)
  const targetLocales = SUPPORTED_LOCALES.filter(
    (l): l is TranslatedLocale => l !== DEFAULT_LOCALE,
  )

  await translate(
    en,
    sourceKeys,
    pluralPaths,
    targetLocales,
    locks,
    prompt,
    cache,
  )

  // Load all locale data for validation
  const localeData = new Map<string, NestedObject>()
  localeData.set('en', en)
  for (const locale of targetLocales) {
    const data = await loadExistingLocale(locale)
    if (data) localeData.set(locale, data)
  }

  const isValid = validate(sourceKeys, targetLocales, localeData)

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
