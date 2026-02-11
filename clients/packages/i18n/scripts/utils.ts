/**
 * Shared utility functions for i18n scripts
 */

export type EntryValue = string | { value: string; llmContext?: string }
export type NestedObject = { [key: string]: EntryValue | NestedObject }
export type TranslationCache = Record<string, Record<string, string>>

/**
 * Check if a value is a plural object (has _mode: 'plural')
 */
function isPluralObject(
  value: unknown,
): value is Record<string, string> & { _mode: 'plural' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_mode' in value &&
    (value as Record<string, unknown>)._mode === 'plural'
  )
}

/**
 * Extract the string value from an entry (handles both string and object formats)
 */
export function getStringValue(entry: EntryValue): string {
  if (typeof entry === 'string') {
    return entry
  }
  return entry.value
}

/**
 * Check if an entry has LLM context metadata
 */
export function hasLlmContext(
  entry: EntryValue,
): entry is { value: string; llmContext: string } {
  return (
    typeof entry === 'object' &&
    'llmContext' in entry &&
    entry.llmContext !== undefined
  )
}

/**
 * Check if value is a leaf node (string or object with 'value' key)
 */
export function isLeafNode(value: unknown): value is EntryValue {
  return (
    typeof value === 'string' ||
    (typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      'value' in value)
  )
}

/**
 * Find all paths in a nested object that are plural objects.
 * Returns a Set of dot-notation paths.
 */
export function findPluralPaths(
  obj: Record<string, unknown>,
  prefix = '',
): Set<string> {
  const paths = new Set<string>()

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (isPluralObject(value)) {
      paths.add(fullKey)
    } else if (typeof value === 'object' && value !== null) {
      for (const p of findPluralPaths(
        value as Record<string, unknown>,
        fullKey,
      )) {
        paths.add(p)
      }
    }
  }

  return paths
}

/**
 * Flatten a nested object into a Map of dot-notation keys to values.
 * Plural objects are expanded: { _mode: 'plural', '=1': '...', other: '...' }
 * becomes separate keys like 'path.=1' and 'path.other' (skipping _mode).
 */
export function flattenKeys(
  obj: NestedObject,
  prefix = '',
): Map<string, EntryValue> {
  const result = new Map<string, EntryValue>()

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (isPluralObject(value)) {
      // Expand plural variants as individual flat keys, skip _mode
      for (const [variant, text] of Object.entries(value)) {
        if (variant === '_mode') continue
        result.set(`${fullKey}.${variant}`, text)
      }
    } else if (isLeafNode(value)) {
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

/**
 * Flatten keys but return string values only (for validation)
 */
export function flattenKeysToStrings(
  obj: NestedObject,
  prefix = '',
): Map<string, string> {
  const result = new Map<string, string>()

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (isPluralObject(value)) {
      for (const [variant, text] of Object.entries(value)) {
        if (variant === '_mode') continue
        result.set(`${fullKey}.${variant}`, text)
      }
    } else if (isLeafNode(value)) {
      result.set(fullKey, getStringValue(value))
    } else if (typeof value === 'object' && value !== null) {
      const nested = flattenKeysToStrings(value as NestedObject, fullKey)
      for (const [k, v] of nested) {
        result.set(k, v)
      }
    }
  }

  return result
}

/**
 * Unflatten a Map of dot-notation keys back into a nested object.
 * Re-injects _mode: 'plural' at tracked plural paths.
 */
export function unflattenKeys(
  map: Map<string, string>,
  pluralPaths: Set<string> = new Set(),
): NestedObject {
  const result: NestedObject = {}

  for (const [key, value] of map) {
    const parts = key.split('.')
    let current = result as Record<string, unknown>

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!(part in current)) {
        current[part] = {}
      }
      current = current[part] as Record<string, unknown>
    }

    current[parts[parts.length - 1]] = value
  }

  // Re-inject _mode: 'plural' at plural paths
  for (const path of pluralPaths) {
    const parts = path.split('.')
    let current = result as Record<string, unknown>

    for (const part of parts) {
      if (!(part in current)) break
      if (part === parts[parts.length - 1]) {
        const obj = current[part]
        if (typeof obj === 'object' && obj !== null) {
          ;(obj as Record<string, unknown>)._mode = 'plural'
        }
      } else {
        current = current[part] as Record<string, unknown>
      }
    }
  }

  return result
}

/**
 * Find keys that have changed (new, modified, or missing from cache)
 */
export function findChangedKeys(
  sourceKeys: Map<string, EntryValue>,
  cache: Record<string, string>,
  existingTranslation: NestedObject,
): string[] {
  const existingKeys = flattenKeys(existingTranslation)
  const changed: string[] = []

  for (const [key, value] of sourceKeys) {
    const currentSource = getStringValue(value)
    const cachedSource = cache[key]
    const hasExistingTranslation = existingKeys.has(key)

    if (!hasExistingTranslation || cachedSource !== currentSource) {
      changed.push(key)
    }
  }

  return changed
}

/**
 * Find keys that exist in translation but not in source (should be removed)
 */
export function findOrphanedKeys(
  sourceKeys: Map<string, EntryValue>,
  existingTranslation: NestedObject,
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

/**
 * Prepare source strings for LLM translation (include context where available)
 */
export function prepareForLLM(
  sourceKeys: Map<string, EntryValue>,
  keys: string[],
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

/**
 * Normalize LLM response (handle both string and object formats)
 */
export function normalizeResponse(
  response: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(response)) {
    if (typeof value === 'string') {
      result[key] = value
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'value' in value
    ) {
      result[key] = (value as { value: string }).value
    }
  }

  return result
}

/**
 * Extract placeholders from a string.
 * Recognizes {name}, {{name}}, ICU patterns, and # (plural count).
 */
export function extractPlaceholders(str: string): string[] {
  const placeholders: string[] = []

  // Match {name} style simple placeholders
  const simpleMatch = str.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)
  for (const match of simpleMatch) {
    placeholders.push(match[1])
  }

  // Match {name, plural/select/selectordinal, ...} style ICU placeholders
  const icuMatch = str.matchAll(
    /\{([a-zA-Z_][a-zA-Z0-9_]*),\s*(?:plural|select|selectordinal)/g,
  )
  for (const match of icuMatch) {
    placeholders.push(match[1])
  }

  // Match {{name}} style placeholders
  const doubleMatch = str.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)
  for (const match of doubleMatch) {
    placeholders.push(match[1])
  }

  // Track presence of # (plural count placeholder)
  if (/#/.test(str)) {
    placeholders.push('#')
  }

  return [...new Set(placeholders)].sort()
}

/**
 * Check if two arrays are equal (same elements in same order)
 */
export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, i) => val === b[i])
}
