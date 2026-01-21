import fs from 'node:fs'
import path from 'node:path'

const EN_FILE = path.join(import.meta.dirname, '../src/locales/en.json')
const TYPES_FILE = path.join(import.meta.dirname, '../src/types.ts')

type EntryValue = string | { value: string; llmContext?: string }
type NestedObject = { [key: string]: EntryValue | NestedObject }

// Extract the string value from an entry
function getStringValue(entry: EntryValue): string {
  if (typeof entry === 'string') {
    return entry
  }
  return entry.value
}

// Check if value is a leaf node (string or object with 'value' key)
function isLeafNode(value: unknown): value is EntryValue {
  return (
    typeof value === 'string' ||
    (typeof value === 'object' && value !== null && 'value' in value)
  )
}

// Extract ICU placeholders from a string
function extractPlaceholders(str: string): string[] {
  const placeholders: string[] = []

  // Match {name} style placeholders (but not ICU plural/select syntax)
  const simpleMatch = str.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)
  for (const match of simpleMatch) {
    // Skip ICU keywords
    if (!['plural', 'select', 'selectordinal'].includes(match[1])) {
      placeholders.push(match[1])
    }
  }

  // Match {{name}} style placeholders
  const doubleMatch = str.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)
  for (const match of doubleMatch) {
    placeholders.push(match[1])
  }

  return [...new Set(placeholders)]
}

// Generate TypeScript interface for messages (actual JSON structure)
function generateMessagesInterface(obj: NestedObject, indent = 2): string {
  const spaces = ' '.repeat(indent)
  const lines: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (isLeafNode(value)) {
      lines.push(`${spaces}${key}: string`)
    } else if (typeof value === 'object' && value !== null) {
      // Nested object
      lines.push(`${spaces}${key}: {`)
      lines.push(generateMessagesInterface(value as NestedObject, indent + 2))
      lines.push(`${spaces}}`)
    }
  }

  return lines.join('\n')
}

// Generate TypeScript interface for params (for type-safe t() calls)
function generateParamsInterface(obj: NestedObject, indent = 2): string {
  const spaces = ' '.repeat(indent)
  const lines: string[] = []

  for (const [key, value] of Object.entries(obj)) {
    if (isLeafNode(value)) {
      const strValue = getStringValue(value)
      const placeholders = extractPlaceholders(strValue)

      if (placeholders.length > 0) {
        // Has placeholders - generate params type
        const paramsType = placeholders.map((p) => `${p}: string | number`).join('; ')
        lines.push(`${spaces}${key}: { ${paramsType} }`)
      } else {
        // No placeholders
        lines.push(`${spaces}${key}: Record<string, never>`)
      }
    } else if (typeof value === 'object' && value !== null) {
      // Nested object
      lines.push(`${spaces}${key}: {`)
      lines.push(generateParamsInterface(value as NestedObject, indent + 2))
      lines.push(`${spaces}}`)
    }
  }

  return lines.join('\n')
}

function generateTypes() {
  const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8')) as NestedObject

  const messagesContent = generateMessagesInterface(en)

  const output = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Run \`pnpm generate-types\` to regenerate

// Represents the actual JSON structure of locale files
export interface Messages {
${messagesContent}
}
`

  fs.writeFileSync(TYPES_FILE, output)
  console.log('Generated types.ts')
}

generateTypes()
