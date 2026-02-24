import { Data, Effect } from 'effect'
import type { RawToken, TokenGroup } from '../types.js'

const TOKEN_NAME_RE = /^[A-Z0-9_]+$/

export class TokenNameValidationError extends Data.TaggedError('TokenNameValidationError')<{
  path: string
  key: string
  message: string
}> {}

function isRawToken(value: unknown): value is RawToken {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    ((typeof (value as RawToken).value === 'string' ||
      typeof (value as RawToken).value === 'number') ||
      typeof (value as RawToken).value === 'object')
  )
}

function validateGroup(
  group: TokenGroup,
  pathParts: string[] = [],
): Effect.Effect<void, TokenNameValidationError> {
  return Effect.gen(function* () {
    for (const key of Object.keys(group)) {
      const currentPath = [...pathParts, key]
      if (!TOKEN_NAME_RE.test(key)) {
        const path = currentPath.join('.')
        return yield* Effect.fail(
          new TokenNameValidationError({
            path,
            key,
            message:
              `Invalid token key "${key}" at "${path}". ` +
              'Token keys must be uppercase alphanumeric with underscores only ([A-Z0-9_]+).',
          }),
        )
      }

      const value = group[key]
      if (typeof value === 'object' && value !== null && !isRawToken(value)) {
        yield* validateGroup(value as TokenGroup, currentPath)
      }
    }
  })
}

export const validateTokenNames = (
  group: TokenGroup,
): Effect.Effect<void, TokenNameValidationError> => validateGroup(group)
