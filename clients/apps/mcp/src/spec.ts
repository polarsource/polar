import spec from './generated/spec.json'

const operationPatterns = Object.entries(spec.paths).flatMap(
  ([path, methods]) => {
    const pattern = new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`)
    return Object.keys(methods).map((method) => ({
      method: method.toUpperCase(),
      pattern,
    }))
  },
)

export const isAllowedOperation = (method: string, pathname: string) =>
  operationPatterns.some(
    (operation) =>
      operation.method === method && operation.pattern.test(pathname),
  )

export { spec }
