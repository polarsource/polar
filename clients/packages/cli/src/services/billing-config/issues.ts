import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import { locateInScript } from '@/services/billing-config/script-locations'
import type {
  ConfigIssue,
  LoadedConfig,
  ServerError,
  SourceLocation,
} from '@/schemas/BillingConfig'

type Path = ReadonlyArray<string | number>

const KEY_ISSUES = new Set(['extra_forbidden'])

const positionOf = (source: string, offset: number) => {
  const before = source.slice(0, offset)
  return {
    line: before.split('\n').length,
    column: offset - before.lastIndexOf('\n'),
  }
}

export const locate = (
  source: string,
  path: Path,
  target: 'key' | 'value' = 'value',
): SourceLocation | undefined => {
  let node = parseTree(source)
  if (!node) return undefined
  for (const segment of path) {
    node = findNodeAtLocation(node, [segment]) ?? node
  }
  const key = node.parent?.children?.[0]
  if (target === 'key' && node.parent?.type === 'property' && key) {
    node = key
  }
  const lineEnd = source.indexOf('\n', node.offset)
  const restOfLine = (lineEnd === -1 ? source.length : lineEnd) - node.offset
  return {
    ...positionOf(source, node.offset),
    length: Math.min(node.length, restOfLine),
  }
}

const unionTag = (error: typeof ServerError.Type) => {
  if (error.type !== 'union_tag_invalid' || !error.ctx) return undefined
  const key = String(error.ctx['discriminator']).replace(/^'|'$/g, '')
  const expected = [
    ...String(error.ctx['expected_tags']).matchAll(/'([^']*)'/g),
  ].map(([, value]) => `'${value}'`)
  return {
    key,
    value: error.ctx['tag'],
    expected:
      expected.length > 1
        ? `${expected.slice(0, -1).join(', ')} or ${expected.at(-1)}`
        : expected.join(''),
  }
}

const valueAt = (input: unknown, path: Path): unknown =>
  path.reduce<unknown>(
    (current, segment) =>
      typeof current === 'object' && current !== null
        ? (current as Record<string | number, unknown>)[segment]
        : undefined,
    input,
  )

const supplied = (config: LoadedConfig, path: Path, input: unknown) =>
  input === null ? valueAt(config.input, path) === null : input !== undefined

const externalIdOf = (input: unknown, path: Path) => {
  const entry = valueAt(input, path)
  const externalId =
    typeof entry === 'object' && entry !== null && 'external_id' in entry
      ? entry.external_id
      : undefined
  return typeof externalId === 'string' && externalId !== ''
    ? externalId
    : undefined
}

const readablePath = (config: LoadedConfig, path: Path) =>
  path
    .map((segment, index) =>
      index === 1 && typeof segment === 'number'
        ? (externalIdOf(config.input, path.slice(0, 2)) ?? segment)
        : segment,
    )
    .join('.')

const issue = (
  config: LoadedConfig,
  error: typeof ServerError.Type,
): ConfigIssue => {
  const loc = error.loc[0] === 'body' ? error.loc.slice(1) : error.loc
  const tag = unionTag(error)
  const path = tag ? [...loc, tag.key] : loc
  const raw = tag ? tag.value : error.input
  const got = supplied(config, path, raw) ? raw : undefined
  return {
    severity: error.severity ?? 'error',
    code: error.type,
    path: readablePath(config, path),
    message: tag ? `Input should be ${tag.expected}` : error.msg,
    got: got === undefined ? undefined : JSON.stringify(got),
    location: config.generated
      ? locateInScript(config.source, config.input, path, got)
      : locate(
          config.source,
          path,
          KEY_ISSUES.has(error.type) ? 'key' : 'value',
        ),
  }
}

export const issues = (
  config: LoadedConfig,
  detail: ReadonlyArray<typeof ServerError.Type>,
) => detail.map((error) => issue(config, error))
