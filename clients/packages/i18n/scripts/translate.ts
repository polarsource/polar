import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import OpenAI from 'openai'

// Load .env.local first (if exists), then .env as fallback
dotenv.config({ path: path.join(import.meta.dirname, '../.env.local') })
dotenv.config({ path: path.join(import.meta.dirname, '../.env') })

const LOCALES_DIR = path.join(import.meta.dirname, '../src/locales')
const EN_FILE = path.join(LOCALES_DIR, 'en.json')
const PROMPT_FILE = path.join(import.meta.dirname, '../src/prompt.md')
const LOCKS_FILE = path.join(import.meta.dirname, '../src/locks.json')
const SUPPORTED_LOCALES_FILE = path.join(import.meta.dirname, '../src/supported_locales.json')
const CACHE_FILE = path.join(import.meta.dirname, '../src/.translation-cache.json')

const LOCALE_NAMES: Record<string, string> = {
  sv: 'Swedish',
  es: 'Spanish',
  fr: 'French',
  nl: 'Dutch',
}

type EntryValue = string | { value: string; llmContext?: string }
type NestedObject = { [key: string]: EntryValue | NestedObject }
type TranslationCache = Record<string, Record<string, string>> // locale -> key -> english source

// Extract the string value from an entry (handles both plain strings and objects with llmContext)
function getStringValue(entry: EntryValue): string {
  if (typeof entry === 'string') {
    return entry
  }
  return entry.value
}

// Check if an entry has llmContext
function hasLlmContext(entry: EntryValue): entry is { value: string; llmContext: string } {
  return typeof entry === 'object' && 'llmContext' in entry && entry.llmContext !== undefined
}

// Flatten nested object to dot-notation keys
function flattenKeys(obj: NestedObject, prefix = ''): Map<string, EntryValue> {
  const result = new Map<string, EntryValue>()

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'string' || (typeof value === 'object' && 'value' in value)) {
      result.set(fullKey, value as EntryValue)
    } else if (typeof value === 'object' && value !== null) {
      const nested = flattenKeys(value as NestedObject, fullKey)
      for (const [k, v] of nested) {
        result.set(k, v)
      }
    }
  }

  return result
}

// Unflatten dot-notation keys back to nested object (values only, no llmContext)
function unflattenKeys(map: Map<string, string>): NestedObject {
  const result: NestedObject = {}

  for (const [key, value] of map) {
    const parts = key.split('.')
    let current = result

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current)) {
        current[part] = {}
      }
      current = current[part] as NestedObject
    }

    current[parts[parts.length - 1]] = value
  }

  return result
}

// Find keys that need translation by comparing current English source with cached English source
function findChangedKeys(
  sourceKeys: Map<string, EntryValue>,
  cache: Record<string, string>, // key -> cached english source
  existingTranslation: NestedObject
): string[] {
  const existingKeys = flattenKeys(existingTranslation)
  const changed: string[] = []

  for (const [key, value] of sourceKeys) {
    const currentSource = getStringValue(value)
    const cachedSource = cache[key]
    const hasExistingTranslation = existingKeys.has(key)

    // Translate if:
    // 1. Key doesn't exist in translation file
    // 2. English source has changed since last translation (cache mismatch)
    // 3. No cache entry exists (never translated before)
    if (!hasExistingTranslation || cachedSource !== currentSource) {
      changed.push(key)
    }
  }

  return changed
}

// Find keys that exist in translation but not in source
function findOrphanedKeys(
  sourceKeys: Map<string, EntryValue>,
  existingTranslation: NestedObject
): string[] {
  const existingKeys = flattenKeys(existingTranslation)
  const orphaned: string[] = []

  for (const key of existingKeys.keys()) {
    if (!sourceKeys.has(key)) {
      orphaned.push(key)
    }
  }

  return orphaned
}

// Prepare strings for LLM translation (includes llmContext if present)
function prepareForLLM(
  sourceKeys: Map<string, EntryValue>,
  keys: string[]
): Record<string, { value: string; llmContext?: string }> {
  const result: Record<string, { value: string; llmContext?: string }> = {}

  for (const key of keys) {
    const entry = sourceKeys.get(key)
    if (!entry) continue

    if (hasLlmContext(entry)) {
      result[key] = { value: entry.value, llmContext: entry.llmContext }
    } else {
      result[key] = { value: getStringValue(entry) }
    }
  }

  return result
}

// Normalize LLM response - extract plain string values if objects are returned
function normalizeResponse(response: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(response)) {
    if (typeof value === 'string') {
      result[key] = value
    } else if (typeof value === 'object' && value !== null && 'value' in value) {
      // LLM returned object format - extract the value
      result[key] = (value as { value: string }).value
    } else {
      console.warn(`  Warning: Unexpected value type for key "${key}": ${typeof value}`)
    }
  }

  return result
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

  console.log(`  Calling OpenAI for ${localeName}...`)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt.split('USER')[0].replace('SYSTEM', '').trim() },
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
    throw new Error(`Invalid JSON response from OpenAI for ${targetLocale}: ${content}`)
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
  // Load source files
  const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8')) as NestedObject
  const locks = JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf-8')) as Record<string, string[]>
  const { supportedLocales } = JSON.parse(
    fs.readFileSync(SUPPORTED_LOCALES_FILE, 'utf-8')
  ) as { supportedLocales: string[] }
  const prompt = fs.readFileSync(PROMPT_FILE, 'utf-8')
  const cache = loadCache()

  const sourceKeys = flattenKeys(en)
  const targetLocales = supportedLocales.filter((l) => l !== 'en')

  console.log(`Source keys: ${[...sourceKeys.keys()].join(', ')}`)
  console.log(`Target locales: ${targetLocales.join(', ')}\n`)

  for (const locale of targetLocales) {
    console.log(`Processing ${locale}...`)

    const localeFile = path.join(LOCALES_DIR, `${locale}.json`)
    const lockedKeys = locks[locale] ?? []
    const localeCache = cache[locale] ?? {}

    // Load existing translation if it exists
    let existing: NestedObject = {}
    if (fs.existsSync(localeFile)) {
      const content = fs.readFileSync(localeFile, 'utf-8').trim()
      if (content && content !== '{}') {
        existing = JSON.parse(content) as NestedObject
      }
    }

    // Find keys that need translation (comparing English source with cache)
    const changedKeys = findChangedKeys(sourceKeys, localeCache, existing).filter(
      (key) => !lockedKeys.includes(key)
    )

    // Find orphaned keys to remove
    const orphanedKeys = findOrphanedKeys(sourceKeys, existing)

    if (changedKeys.length === 0 && orphanedKeys.length === 0) {
      console.log(`  No changes needed\n`)
      continue
    }

    console.log(`  Keys to translate: ${changedKeys.length}`)
    console.log(`  Keys to remove: ${orphanedKeys.length}`)

    // Prepare and call LLM
    let translations: Record<string, string> = {}
    if (changedKeys.length > 0) {
      const toTranslate = prepareForLLM(sourceKeys, changedKeys)
      translations = await callLLM(locale, toTranslate, prompt)
    }

    // Build updated translation
    const existingFlat = flattenKeys(existing)
    const updatedFlat = new Map<string, string>()

    // Keep existing translations for unchanged keys
    for (const [key, value] of existingFlat) {
      if (!orphanedKeys.includes(key) && !changedKeys.includes(key)) {
        updatedFlat.set(key, getStringValue(value))
      }
    }

    // Add new translations and update cache
    for (const key of changedKeys) {
      if (translations[key]) {
        updatedFlat.set(key, translations[key])
        // Update cache with the English source that was used for this translation
        localeCache[key] = getStringValue(sourceKeys.get(key)!)
      } else {
        console.warn(`  Warning: No translation received for key "${key}"`)
      }
    }

    // Remove orphaned keys from cache
    for (const key of orphanedKeys) {
      delete localeCache[key]
    }

    // Update cache for this locale
    cache[locale] = localeCache

    // Unflatten and write
    const updated = unflattenKeys(updatedFlat)
    fs.writeFileSync(localeFile, JSON.stringify(updated, null, 2) + '\n')
    console.log(`  Written to ${locale}.json\n`)
  }

  // Save cache
  saveCache(cache)

  console.log('Translation complete!')
}

translate().catch((error) => {
  console.error('Translation failed:', error)
  process.exit(1)
})
