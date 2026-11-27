import type { Node } from './types.ts'

type Expression = Node<'CallExpression'>['callee']

const propertyName = (node: Node<'MemberExpression'>) => {
  const { property } = node
  if (!node.computed && property.type === 'Identifier') return property.name
  return node.computed &&
    property.type === 'Literal' &&
    typeof property.value === 'string'
    ? property.value
    : undefined
}

export const isGlobal = (node: Expression, name: string) =>
  (node.type === 'Identifier' && node.name === name) ||
  (node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.name === 'globalThis' &&
    propertyName(node) === name)

export const isMember = (
  node: Expression,
  objectName: string,
  expected?: string,
) => {
  if (node.type !== 'MemberExpression') return false
  if (!isGlobal(node.object, objectName)) return false
  const name = propertyName(node)
  return name !== undefined && (expected === undefined || name === expected)
}
