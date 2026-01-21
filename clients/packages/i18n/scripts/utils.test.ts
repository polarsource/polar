import { describe, it, expect } from 'vitest'
import {
  getStringValue,
  hasLlmContext,
  isLeafNode,
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

describe('getStringValue', () => {
  it('returns string directly when input is string', () => {
    expect(getStringValue('hello')).toBe('hello')
  })

  it('extracts value from object with value property', () => {
    expect(getStringValue({ value: 'hello' })).toBe('hello')
  })

  it('extracts value from object with value and llmContext', () => {
    expect(getStringValue({ value: 'hello', llmContext: 'context' })).toBe(
      'hello'
    )
  })
})

describe('hasLlmContext', () => {
  it('returns false for plain strings', () => {
    expect(hasLlmContext('hello')).toBe(false)
  })

  it('returns false for object without llmContext', () => {
    expect(hasLlmContext({ value: 'hello' })).toBe(false)
  })

  it('returns true for object with llmContext', () => {
    expect(hasLlmContext({ value: 'hello', llmContext: 'context' })).toBe(true)
  })

  it('returns false for object with undefined llmContext', () => {
    expect(hasLlmContext({ value: 'hello', llmContext: undefined })).toBe(false)
  })
})

describe('isLeafNode', () => {
  it('returns true for strings', () => {
    expect(isLeafNode('hello')).toBe(true)
  })

  it('returns true for objects with value property', () => {
    expect(isLeafNode({ value: 'hello' })).toBe(true)
  })

  it('returns false for nested objects', () => {
    expect(isLeafNode({ nested: { value: 'hello' } })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isLeafNode(null)).toBe(false)
  })

  it('returns false for arrays', () => {
    expect(isLeafNode(['hello'])).toBe(false)
  })
})

describe('flattenKeys', () => {
  it('flattens simple object', () => {
    const obj = { greeting: 'hello', farewell: 'goodbye' }
    const result = flattenKeys(obj)

    expect(result.get('greeting')).toBe('hello')
    expect(result.get('farewell')).toBe('goodbye')
    expect(result.size).toBe(2)
  })

  it('flattens nested objects with dot notation', () => {
    const obj = {
      messages: {
        greeting: 'hello',
        farewell: 'goodbye',
      },
    }
    const result = flattenKeys(obj)

    expect(result.get('messages.greeting')).toBe('hello')
    expect(result.get('messages.farewell')).toBe('goodbye')
    expect(result.size).toBe(2)
  })

  it('handles deeply nested objects', () => {
    const obj = {
      level1: {
        level2: {
          level3: 'deep value',
        },
      },
    }
    const result = flattenKeys(obj)

    expect(result.get('level1.level2.level3')).toBe('deep value')
    expect(result.size).toBe(1)
  })

  it('handles object entries with value property', () => {
    const obj = {
      greeting: { value: 'hello', llmContext: 'A greeting message' },
    }
    const result = flattenKeys(obj)

    expect(result.get('greeting')).toEqual({
      value: 'hello',
      llmContext: 'A greeting message',
    })
  })

  it('handles mixed string and object entries', () => {
    const obj = {
      simple: 'hello',
      complex: { value: 'world', llmContext: 'context' },
    }
    const result = flattenKeys(obj)

    expect(result.get('simple')).toBe('hello')
    expect(result.get('complex')).toEqual({
      value: 'world',
      llmContext: 'context',
    })
  })
})

describe('flattenKeysToStrings', () => {
  it('extracts string values from all entries', () => {
    const obj = {
      simple: 'hello',
      complex: { value: 'world', llmContext: 'context' },
    }
    const result = flattenKeysToStrings(obj)

    expect(result.get('simple')).toBe('hello')
    expect(result.get('complex')).toBe('world')
  })
})

describe('unflattenKeys', () => {
  it('unflattens simple keys', () => {
    const map = new Map([
      ['greeting', 'hello'],
      ['farewell', 'goodbye'],
    ])
    const result = unflattenKeys(map)

    expect(result).toEqual({ greeting: 'hello', farewell: 'goodbye' })
  })

  it('unflattens dot-notation keys into nested objects', () => {
    const map = new Map([
      ['messages.greeting', 'hello'],
      ['messages.farewell', 'goodbye'],
    ])
    const result = unflattenKeys(map)

    expect(result).toEqual({
      messages: {
        greeting: 'hello',
        farewell: 'goodbye',
      },
    })
  })

  it('handles deeply nested keys', () => {
    const map = new Map([['level1.level2.level3', 'deep value']])
    const result = unflattenKeys(map)

    expect(result).toEqual({
      level1: {
        level2: {
          level3: 'deep value',
        },
      },
    })
  })

  it('round-trips with flattenKeysToStrings', () => {
    const original = {
      checkout: {
        email: 'Email',
        submit: 'Submit',
      },
      common: {
        cancel: 'Cancel',
      },
    }
    const flattened = flattenKeysToStrings(original)
    const unflattened = unflattenKeys(flattened)

    expect(unflattened).toEqual(original)
  })
})

describe('findChangedKeys', () => {
  it('returns all keys when cache is empty', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello'],
      ['farewell', 'goodbye'],
    ])
    const cache = {}
    const existing = {}

    const result = findChangedKeys(sourceKeys, cache, existing)

    expect(result).toEqual(['greeting', 'farewell'])
  })

  it('returns empty when all keys are cached and unchanged', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello'],
    ])
    const cache = { greeting: 'hello' }
    const existing = { greeting: 'hola' }

    const result = findChangedKeys(sourceKeys, cache, existing)

    expect(result).toEqual([])
  })

  it('detects changed source values', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello updated'],
    ])
    const cache = { greeting: 'hello' }
    const existing = { greeting: 'hola' }

    const result = findChangedKeys(sourceKeys, cache, existing)

    expect(result).toEqual(['greeting'])
  })

  it('detects missing translations', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello'],
      ['farewell', 'goodbye'],
    ])
    const cache = { greeting: 'hello', farewell: 'goodbye' }
    const existing = { greeting: 'hola' } // farewell is missing

    const result = findChangedKeys(sourceKeys, cache, existing)

    expect(result).toEqual(['farewell'])
  })
})

describe('findOrphanedKeys', () => {
  it('returns empty when all translation keys exist in source', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello'],
    ])
    const existing = { greeting: 'hola' }

    const result = findOrphanedKeys(sourceKeys, existing)

    expect(result).toEqual([])
  })

  it('finds keys in translation that do not exist in source', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello'],
    ])
    const existing = { greeting: 'hola', oldKey: 'viejo' }

    const result = findOrphanedKeys(sourceKeys, existing)

    expect(result).toEqual(['oldKey'])
  })

  it('handles nested orphaned keys', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['messages.greeting', 'hello'],
    ])
    const existing = {
      messages: {
        greeting: 'hola',
        oldMessage: 'viejo',
      },
    }

    const result = findOrphanedKeys(sourceKeys, existing)

    expect(result).toEqual(['messages.oldMessage'])
  })
})

describe('prepareForLLM', () => {
  it('prepares simple strings for LLM', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello'],
    ])

    const result = prepareForLLM(sourceKeys, ['greeting'])

    expect(result).toEqual({
      greeting: { value: 'hello' },
    })
  })

  it('includes llmContext when available', () => {
    const sourceKeys = new Map<
      string,
      string | { value: string; llmContext?: string }
    >([['greeting', { value: 'hello', llmContext: 'A friendly greeting' }]])

    const result = prepareForLLM(sourceKeys, ['greeting'])

    expect(result).toEqual({
      greeting: { value: 'hello', llmContext: 'A friendly greeting' },
    })
  })

  it('only includes requested keys', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello'],
      ['farewell', 'goodbye'],
    ])

    const result = prepareForLLM(sourceKeys, ['greeting'])

    expect(result).toEqual({
      greeting: { value: 'hello' },
    })
    expect(result.farewell).toBeUndefined()
  })

  it('skips keys not in sourceKeys', () => {
    const sourceKeys = new Map<string, string | { value: string }>([
      ['greeting', 'hello'],
    ])

    const result = prepareForLLM(sourceKeys, ['greeting', 'nonexistent'])

    expect(result).toEqual({
      greeting: { value: 'hello' },
    })
  })
})

describe('normalizeResponse', () => {
  it('passes through string values', () => {
    const response = { greeting: 'hola', farewell: 'adios' }

    const result = normalizeResponse(response)

    expect(result).toEqual({ greeting: 'hola', farewell: 'adios' })
  })

  it('extracts value from object responses', () => {
    const response = {
      greeting: { value: 'hola' },
      farewell: { value: 'adios' },
    }

    const result = normalizeResponse(response)

    expect(result).toEqual({ greeting: 'hola', farewell: 'adios' })
  })

  it('handles mixed string and object responses', () => {
    const response = {
      greeting: 'hola',
      farewell: { value: 'adios' },
    }

    const result = normalizeResponse(response)

    expect(result).toEqual({ greeting: 'hola', farewell: 'adios' })
  })

  it('ignores invalid values', () => {
    const response = {
      greeting: 'hola',
      invalid: 123,
      alsoInvalid: null,
    }

    const result = normalizeResponse(response as Record<string, unknown>)

    expect(result).toEqual({ greeting: 'hola' })
  })
})

describe('extractPlaceholders', () => {
  it('returns empty array for strings without placeholders', () => {
    expect(extractPlaceholders('Hello world')).toEqual([])
  })

  it('extracts single placeholder', () => {
    expect(extractPlaceholders('Hello {name}')).toEqual(['name'])
  })

  it('extracts multiple placeholders', () => {
    expect(extractPlaceholders('Hello {firstName} {lastName}')).toEqual([
      'firstName',
      'lastName',
    ])
  })

  it('returns sorted and unique placeholders', () => {
    expect(extractPlaceholders('{b} {a} {b} {c}')).toEqual(['a', 'b', 'c'])
  })

  it('extracts double-brace placeholders', () => {
    expect(extractPlaceholders('Hello {{name}}')).toEqual(['name'])
  })

  it('ignores ICU keywords', () => {
    expect(
      extractPlaceholders('{count, plural, one {# item} other {# items}}')
    ).toEqual(['count'])
  })

  it('handles complex ICU messages', () => {
    const message =
      '{name} has {count, plural, one {# message} other {# messages}}'
    expect(extractPlaceholders(message)).toEqual(['count', 'name'])
  })

  it('handles underscores in placeholder names', () => {
    expect(extractPlaceholders('Hello {first_name}')).toEqual(['first_name'])
  })

  it('handles numbers in placeholder names', () => {
    expect(extractPlaceholders('Value: {value1}')).toEqual(['value1'])
  })
})

describe('arraysEqual', () => {
  it('returns true for identical arrays', () => {
    expect(arraysEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true)
  })

  it('returns true for empty arrays', () => {
    expect(arraysEqual([], [])).toBe(true)
  })

  it('returns false for different lengths', () => {
    expect(arraysEqual(['a', 'b'], ['a', 'b', 'c'])).toBe(false)
  })

  it('returns false for different elements', () => {
    expect(arraysEqual(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(false)
  })

  it('returns false for same elements in different order', () => {
    expect(arraysEqual(['a', 'b', 'c'], ['c', 'b', 'a'])).toBe(false)
  })
})
