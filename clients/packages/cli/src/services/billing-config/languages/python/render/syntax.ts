const WIDTH = 88

const INDENT = '    '

export type Node =
  | string
  | { readonly head: string; readonly args: ReadonlyArray<Node> }

const flat = (node: Node): string =>
  typeof node === 'string'
    ? node
    : `${node.head}(${node.args.map(flat).join(', ')})`

const print = (node: Node, indent: string, suffix = ''): string => {
  const line = `${indent}${flat(node)}${suffix}`
  if (typeof node === 'string' || line.length <= WIDTH) return line
  return [
    `${indent}${node.head}(`,
    ...node.args.map((arg) => print(arg, `${indent}${INDENT}`, ',')),
    `${indent})${suffix}`,
  ].join('\n')
}

export const literal = (value: string | number | boolean) => {
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  const quoted = JSON.stringify(value)
  return typeof value === 'string' &&
    value.includes('"') &&
    !value.includes("'")
    ? `'${quoted.slice(1, -1).replaceAll('\\"', '"')}'`
    : quoted
}

export const keyword = (name: string, node: Node): Node =>
  typeof node === 'string'
    ? `${name}=${node}`
    : { ...node, head: `${name}=${node.head}` }

export const option = (name: string, value: string | undefined) =>
  value === undefined ? [] : [`${name}=${value}`]

export const importLine = (names: ReadonlySet<string>) => {
  const sorted = [...names].toSorted(
    (a, b) =>
      Number(/^[a-z]/.test(a)) - Number(/^[a-z]/.test(b)) ||
      (a.toLowerCase() < b.toLowerCase() ? -1 : 1),
  )
  const line = `from polar.config import ${sorted.join(', ')}`
  return line.length <= WIDTH
    ? line
    : [
        'from polar.config import (',
        ...sorted.map((name) => `${INDENT}${name},`),
        ')',
      ].join('\n')
}

export const entry = (
  attribute: string,
  helper: string,
  args: ReadonlyArray<Node>,
) => print({ head: `${attribute} = ${helper}`, args }, INDENT)

export const classBlock = (
  name: string,
  base: string,
  entries: ReadonlyArray<string>,
) => [
  `class ${name}(${base}):`,
  ...(entries.length === 0 ? [`${INDENT}pass`] : entries),
]
