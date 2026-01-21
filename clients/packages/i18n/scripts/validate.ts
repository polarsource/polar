import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.join(import.meta.dirname, '../src/locales/generated-translations')
const EN_FILE = path.join(import.meta.dirname, '../src/locales/en.json')
const SUPPORTED_LOCALES_FILE = path.join(import.meta.dirname, '../src/locales/config/supported.json')

type EntryValue = string | { value: string; llmContext?: string }
type NestedObject = { [key: string]: EntryValue | NestedObject }

function getStringValue(entry: EntryValue): string {
  if (typeof entry === 'string') {
    return entry
  }
  return entry.value
}

function isLeafNode(value: unknown): value is EntryValue {
  return (
    typeof value === 'string' ||
    (typeof value === 'object' && value !== null && 'value' in value)
  )
}

function flattenKeys(obj: NestedObject, prefix = ''): Map<string, string> {
  const result = new Map<string, string>()

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (isLeafNode(value)) {
      result.set(fullKey, getStringValue(value))
    } else if (typeof value === 'object' && value !== null) {
      const nested = flattenKeys(value as NestedObject, fullKey)
      for (const [k, v] of nested) {
        result.set(k, v)
      }
    }
  }

  return result
}

function extractPlaceholders(str: string): string[] {
  const placeholders: string[] = []

  const simpleMatch = str.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)
  for (const match of simpleMatch) {
    if (!['plural', 'select', 'selectordinal'].includes(match[1])) {
      placeholders.push(match[1])
    }
  }

  const doubleMatch = str.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)
  for (const match of doubleMatch) {
    placeholders.push(match[1])
  }

  return placeholders.sort()
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, i) => val === b[i])
}

function validate() {
  const errors: string[] = []

  const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8')) as NestedObject
  const { supportedLocales } = JSON.parse(
    fs.readFileSync(SUPPORTED_LOCALES_FILE, 'utf-8')
  ) as { supportedLocales: string[] }

  const sourceKeys = flattenKeys(en)
  const targetLocales = supportedLocales.filter((l) => l !== 'en')

  console.log(`Validating ${targetLocales.length} locales against en.json`)
  console.log(`Source has ${sourceKeys.size} keys\n`)

  for (const locale of targetLocales) {
    const localeFile = path.join(LOCALES_DIR, `${locale}.json`)

    if (!fs.existsSync(localeFile)) {
      errors.push(`${locale}: File does not exist`)
      continue
    }

    console.log(`Checking ${locale}...`)

    const translation = JSON.parse(fs.readFileSync(localeFile, 'utf-8')) as NestedObject
    const translationKeys = flattenKeys(translation)

    const missingKeys: string[] = []
    for (const key of sourceKeys.keys()) {
      if (!translationKeys.has(key)) {
        missingKeys.push(key)
      }
    }

    if (missingKeys.length > 0) {
      errors.push(`${locale}: Missing keys: ${missingKeys.join(', ')}`)
    }

    const extraKeys: string[] = []
    for (const key of translationKeys.keys()) {
      if (!sourceKeys.has(key)) {
        extraKeys.push(key)
      }
    }

    if (extraKeys.length > 0) {
      errors.push(`${locale}: Extra keys: ${extraKeys.join(', ')}`)
    }

    for (const [key, sourceValue] of sourceKeys) {
      const translationValue = translationKeys.get(key)
      if (!translationValue) continue

      const sourcePlaceholders = extractPlaceholders(sourceValue)
      const translationPlaceholders = extractPlaceholders(translationValue)

      if (!arraysEqual(sourcePlaceholders, translationPlaceholders)) {
        errors.push(
          `${locale}.${key}: Placeholder mismatch. Expected: [${sourcePlaceholders.join(', ')}], Got: [${translationPlaceholders.join(', ')}]`
        )
      }
    }

    if (missingKeys.length === 0 && extraKeys.length === 0) {
      console.log(`  ✓ All keys present`)
    }
  }

  console.log('')

  if (errors.length > 0) {
    console.error('Validation failed with errors:')
    for (const error of errors) {
      console.error(`  ✗ ${error}`)
    }
    process.exit(1)
  }

  console.log('✓ All translations valid!')
}

validate()
