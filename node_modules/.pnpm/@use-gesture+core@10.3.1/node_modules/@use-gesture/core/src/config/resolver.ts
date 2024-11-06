import { sharedConfigResolver } from './sharedConfigResolver'
import { ConfigResolverMap } from '../actions'
import { GestureKey, InternalConfig, UserGestureConfig } from '../types'

export type Resolver = (x: any, key: string, obj: any) => any
export type ResolverMap = { [k: string]: Resolver | ResolverMap | boolean }

export function resolveWith<T extends { [k: string]: any }, V extends { [k: string]: any }>(
  config: Partial<T> = {},
  resolvers: ResolverMap
): V {
  const result: any = {}

  for (const [key, resolver] of Object.entries(resolvers)) {
    switch (typeof resolver) {
      case 'function':
        if (process.env.NODE_ENV === 'development') {
          const r = resolver.call(result, config[key], key, config)
          // prevents deprecated resolvers from applying in dev mode
          if (!Number.isNaN(r)) result[key] = r
        } else {
          result[key] = resolver.call(result, config[key], key, config)
        }
        break
      case 'object':
        result[key] = resolveWith(config[key], resolver)
        break
      case 'boolean':
        if (resolver) result[key] = config[key]
        break
    }
  }

  return result
}

export function parse(newConfig: UserGestureConfig, gestureKey?: GestureKey, _config: any = {}): InternalConfig {
  const { target, eventOptions, window, enabled, transform, ...rest } = newConfig as any

  _config.shared = resolveWith({ target, eventOptions, window, enabled, transform }, sharedConfigResolver)

  if (gestureKey) {
    const resolver = ConfigResolverMap.get(gestureKey)!
    _config[gestureKey] = resolveWith({ shared: _config.shared, ...rest }, resolver)
  } else {
    for (const key in rest) {
      const resolver = ConfigResolverMap.get(key as GestureKey)!

      if (resolver) {
        _config[key] = resolveWith({ shared: _config.shared, ...rest[key] }, resolver)
      } else if (process.env.NODE_ENV === 'development') {
        if (!['drag', 'pinch', 'scroll', 'wheel', 'move', 'hover'].includes(key)) {
          if (key === 'domTarget') {
            throw Error(`[@use-gesture]: \`domTarget\` option has been renamed to \`target\`.`)
          }
          // eslint-disable-next-line no-console
          console.warn(
            `[@use-gesture]: Unknown config key \`${key}\` was used. Please read the documentation for further information.`
          )
        }
      }
    }
  }
  return _config
}
