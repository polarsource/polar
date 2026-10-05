import { SchemaError } from './error'
import type { EventDef } from './event'
import type { MeterDef } from './meter'

export type SchemaDef = EventDef | MeterDef

/** Every definition by name, usually `import * as schema from './schema'`. */
export type Schema = { readonly [name: string]: SchemaDef }

type MetersOf<S extends Schema> = Extract<S[keyof S], MeterDef>

export interface Config<S extends Schema = Schema> {
  readonly schema: S
  readonly meters: readonly MetersOf<S>[]
}

export type MeterKey<C extends Pick<Config, 'meters'>> =
  C['meters'][number]['key']

export function defineConfig<S extends Schema>({
  schema,
}: {
  readonly schema: S
}): Config<S> {
  const meters = new Map<string, MeterDef>()
  for (const [name, def] of Object.entries(schema)) {
    if (def.kind === 'event') continue
    if (def.kind !== 'meter') {
      throw new SchemaError('schema', `${name} is not a meter or an event`)
    }
    const defined = meters.get(def.key)
    if (defined !== undefined && defined !== def) {
      throw new SchemaError('meter', `${def.key} is defined twice`)
    }
    meters.set(def.key, def)
  }
  return { schema, meters: [...meters.values()] as MetersOf<S>[] }
}
