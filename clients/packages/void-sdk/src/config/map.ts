import type { Json, Metadata } from './schema'

type Instruction = readonly [string, string]

/** A small arithmetic parser; expressions are never evaluated as JavaScript. */
export function compileExpression(expression: string): Instruction[] {
  const tokens =
    expression.match(
      /\$[A-Za-z_][A-Za-z0-9_]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[()+*/-]|\S/g,
    ) ?? []
  let index = 0
  const fail = (): never => {
    throw new Error(`Invalid map expression: ${expression}`)
  }
  const atom = (): Instruction[] => {
    const token = tokens[index++]
    if (token === '+' || token === '-')
      return [...atom(), [token === '-' ? 'neg' : 'pos', '']]
    if (token === '(') {
      const result = add()
      if (tokens[index++] !== ')') return fail()
      return result
    }
    if (token && /^\$[A-Za-z_][A-Za-z0-9_]*$/.test(token))
      return [['ref', token.slice(1)]]
    if (
      token &&
      /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(token) &&
      Number.isFinite(Number(token))
    )
      return [['number', token]]
    return fail()
  }
  const multiply = (): Instruction[] => {
    let result = atom()
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index++]!
      result = [...result, ...atom(), [operator, '']]
    }
    return result
  }
  const add = (): Instruction[] => {
    let result = multiply()
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++]!
      result = [...result, ...multiply(), [operator, '']]
    }
    return result
  }
  const result = add()
  if (index !== tokens.length) return fail()
  if (
    result.length === 1 &&
    result[0]![0] === 'ref' &&
    !/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(expression)
  )
    result.push(['pos', ''])
  return result
}

export function validateMap(mapping: Metadata): void {
  JSON.stringify(mapping, (_key, value: unknown) => {
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new Error('Map literals must be finite JSON numbers')
    return value
  })
  for (const value of Object.values(mapping))
    if (typeof value === 'string' && value.includes('$'))
      compileExpression(value)
}

export function mapMetadata(
  mapping: Metadata | null | undefined,
  metadata: Metadata,
): Metadata {
  if (mapping == null) return metadata
  const read = (key: string): Json =>
    Object.hasOwn(metadata, key) ? (metadata[key] ?? null) : null
  return Object.fromEntries(
    Object.entries(mapping).map(([key, value]) => {
      if (typeof value !== 'string' || !value.includes('$')) return [key, value]
      const program = compileExpression(value)
      if (program.length === 1 && program[0]![0] === 'ref')
        return [key, read(program[0]![1])]
      const stack: (number | null)[] = []
      for (const [op, argument] of program) {
        if (op === 'ref' || op === 'number') {
          const input = op === 'ref' ? read(argument) : Number(argument)
          stack.push(
            typeof input === 'number' && Number.isFinite(input) ? input : null,
          )
        } else if (op === 'neg' || op === 'pos') {
          const input = stack.pop() ?? null
          stack.push(input === null ? null : op === 'neg' ? -input : input)
        } else {
          const right = stack.pop() ?? null,
            left = stack.pop() ?? null
          const result =
            left === null || right === null
              ? null
              : op === '+'
                ? left + right
                : op === '-'
                  ? left - right
                  : op === '*'
                    ? left * right
                    : right === 0
                      ? null
                      : left / right
          stack.push(result !== null && Number.isFinite(result) ? result : null)
        }
      }
      return [key, stack[0] ?? null]
    }),
  )
}
