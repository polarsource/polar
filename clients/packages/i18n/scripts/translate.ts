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
  unflattenKeys,
  findChangedKeys,
  findOrphanedKeys,
  prepareForLLM,
  normalizeResponse,
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

async function translate() {
  const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8')) as NestedObject
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

  log.header('LLM i18n translation')
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
  log.done('OpenAI translation complete')
}

translate().catch((error) => {
  log.blank()
  log.error(`Translation failed: ${error.message}`)
  process.exit(1)
})
