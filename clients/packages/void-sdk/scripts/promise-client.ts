interface Parameter {
  in: string
  required?: boolean
}
interface Operation {
  operationId?: string
  parameters?: Parameter[]
  requestBody?: { required?: boolean }
}
export interface OpenApi {
  paths: Record<string, Record<string, Operation>>
}

/** Group server operation IDs; reuse the generated client's exact argument types. */
export function promiseClientSource(spec: OpenApi): string {
  const groups = new Map<string, string[]>()
  for (const [path, operations] of Object.entries(spec.paths)) {
    for (const [verb, operation] of Object.entries(operations)) {
      if (
        ![
          'get',
          'post',
          'put',
          'patch',
          'delete',
          'head',
          'options',
          'trace',
        ].includes(verb)
      ) {
        throw new Error(`Unsupported path item ${verb} at ${path}`)
      }
      const match = operation.operationId?.match(
        /^([a-z][a-zA-Z0-9]*):([a-z][a-zA-Z0-9]*)$/,
      )
      if (!match)
        throw new Error(
          `Expected resource:action operationId for ${verb} ${path}`,
        )
      const [, resource, action] = match
      if (!resource || !action)
        throw new Error(`Invalid operationId at ${path}`)
      const method = resource + action[0]?.toUpperCase() + action.slice(1)
      const parameters = operation.parameters ?? []
      if (
        parameters.some(
          (parameter) => !['path', 'query'].includes(parameter.in),
        )
      ) {
        throw new Error(
          `Unsupported parameter location in ${operation.operationId}`,
        )
      }
      const pathCount = parameters.filter(
        (parameter) => parameter.in === 'path',
      ).length
      const args = Array.from(
        { length: pathCount },
        (_, index) =>
          `arg${index}: Parameters<Client[${JSON.stringify(method)}]>[${index}]`,
      )
      const callArgs = Array.from(
        { length: pathCount },
        (_, index) => `arg${index}`,
      )
      const options = `NonNullable<Parameters<Client[${JSON.stringify(method)}]>[${pathCount}]>`
      const fields: string[] = []
      const query = parameters.filter((parameter) => parameter.in === 'query')
      if (query.length) {
        args.push(
          `params: NonNullable<${options}['params']>${query.some((parameter) => parameter.required) ? '' : ' = {}'}`,
        )
        fields.push('params')
      }
      if (operation.requestBody) {
        args.push(
          `payload${operation.requestBody.required ? '' : '?'}: ${options}['payload']`,
        )
        fields.push('payload')
      }
      // Required arguments cannot follow a default or optional argument.
      if (query.length && operation.requestBody) {
        throw new Error(
          `Combined query and body inputs need an explicit convention: ${operation.operationId}`,
        )
      }
      callArgs.push(fields.length ? `{ ${fields.join(', ')} }` : 'undefined')
      const entries = groups.get(resource) ?? []
      if (
        entries.some((entry) =>
          entry.startsWith(`    ${JSON.stringify(action)}:`),
        )
      ) {
        throw new Error(`Duplicate operationId ${operation.operationId}`)
      }
      entries.push(
        `    ${JSON.stringify(action)}: (${args.join(', ')}) => run(api[${JSON.stringify(method)}](${callArgs.join(', ')})),`,
      )
      groups.set(resource, entries)
    }
  }
  return `// Grouped Promise client.
import type { ApiError, Client } from './index'

type Run = <A>(effect: Effect.Effect<A, ApiError>) => Promise<A>

export const makePromiseClient = (api: Client, run: Run) => ({
${[...groups].map(([resource, methods]) => `  ${JSON.stringify(resource)}: {\n${methods.join('\n')}\n  },`).join('\n')}
})

export type PromiseClient = ReturnType<typeof makePromiseClient>
`
}
