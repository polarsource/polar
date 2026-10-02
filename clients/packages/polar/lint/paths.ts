import path from 'node:path'
import type { Context, Node } from './types.ts'

type SourceNode =
  | Node<'ImportDeclaration'>
  | Node<'ImportExpression'>
  | Node<'ExportAllDeclaration'>
  | Node<'ExportNamedDeclaration'>

const SOURCE_ROOT = '/src/'

export const locate = (context: Context) => {
  const filename = context.filename.replaceAll('\\', '/')
  const index = filename.lastIndexOf(SOURCE_ROOT)
  return index === -1 ? undefined : filename.slice(index + SOURCE_ROOT.length)
}

export const isTestFile = (file: string) => file.endsWith('.test.ts')

export const areaOf = (file: string) => {
  const [area = file] = file.split('/')
  return area
}

export const sourceOf = (node: SourceNode) => {
  const { source } = node
  return source?.type === 'Literal' && typeof source.value === 'string'
    ? source.value
    : undefined
}

export const resolveImport = (file: string, source: string) => {
  if (source.startsWith('@/')) return source.slice(2)
  if (!source.startsWith('.')) return undefined
  const resolved = path.posix.join(path.posix.dirname(file), source)
  return resolved.startsWith('..') ? undefined : resolved
}
