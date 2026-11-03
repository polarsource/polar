import publicPaths from './generated/public-paths.json'
import scopes from './generated/scopes.json'
import spec from './generated/spec.json'
import { isRecord } from './json'

const operations = Object.entries(spec.paths).flatMap(([path, methods]) => {
  const pattern = new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`)
  return Object.keys(methods).map((method) => ({
    method: method.toUpperCase(),
    path,
    pattern,
  }))
})

export const operationFor = (method: string, pathname: string) =>
  operations.find(
    (operation) =>
      operation.method === method && operation.pattern.test(pathname),
  )?.path

export const isAllowedOperation = (method: string, pathname: string) =>
  operationFor(method, pathname) !== undefined

const literalSegmentsAt: Array<Set<string>> = []
for (const path of publicPaths) {
  path.split('/').forEach((segment, index) => {
    if (!segment.startsWith('{')) {
      ;(literalSegmentsAt[index] ??= new Set()).add(segment)
    }
  })
}

export const redactPath = (pathname: string) =>
  pathname
    .split('/')
    .map((segment, index) =>
      literalSegmentsAt[index]?.has(segment) ? segment : '{}',
    )
    .join('/')

const IDENTIFIER = /^[a-z][a-z0-9_]*$/

const identifierOrPlaceholder = (value: unknown) =>
  typeof value === 'number' || IDENTIFIER.test(String(value))
    ? String(value)
    : '{}'

export const rejectedFields = (body: unknown) => {
  const detail = isRecord(body) ? body.detail : undefined
  if (!Array.isArray(detail)) return undefined
  const fields = detail.flatMap((issue) =>
    isRecord(issue) && Array.isArray(issue.loc)
      ? [
          `${issue.loc.map(identifierOrPlaceholder).join('.')} ${identifierOrPlaceholder(issue.type)}`,
        ]
      : [],
  )
  return fields.length > 0 ? fields : undefined
}

export const readScopes = scopes.read
export const allScopes = [...scopes.read, ...scopes.write]

export { spec }
