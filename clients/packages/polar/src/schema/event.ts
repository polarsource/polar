import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Predicate } from 'effect'
import type { models } from '../sdk'

export type EventMetadata = models.EventMetadataInput

export type EventSchema = StandardSchemaV1<unknown, EventMetadata>

export type EventSchemas = Readonly<Record<string, EventSchema>>

export type EventDefinitions = Readonly<Record<string, StandardSchemaV1>>

export type EventInput<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferInput<Schema>

export type EventOutput<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<Schema>

type ReservedProperty = 'name' | 'source' | 'timestamp'
type StructuredProperty = '_cost' | '_llm'
type Scalar = string | number | boolean

type InvalidProperty<Metadata> = {
  [Key in keyof Metadata]-?: Key extends ReservedProperty
    ? Key
    : Key extends StructuredProperty
      ? Metadata[Key] extends EventMetadata[Key]
        ? never
        : Key
      : Exclude<Metadata[Key], undefined> extends Scalar
        ? never
        : Key
}[keyof Metadata] &
  string

type ValidEvent<Name, Schema extends StandardSchemaV1> =
  EventOutput<Schema> extends object
    ? [InvalidProperty<EventOutput<Schema>>] extends [never]
      ? Schema
      : `Event "${Name & string}" has invalid metadata property "${InvalidProperty<EventOutput<Schema>>}": metadata values must be strings, numbers or booleans, and name, source and timestamp are reserved.`
    : `Event "${Name & string}" must be described by an object schema.`

export type ValidEvents<Events extends EventDefinitions> = {
  readonly [Name in keyof Events]: ValidEvent<Name, Events[Name]>
}

type Shared<Metadata> = Pick<Metadata, keyof Metadata>

export type SharedEventOutput<
  Events extends EventDefinitions,
  Name extends keyof Events,
> = Shared<EventOutput<Events[Name]>>

export const eventKey: unique symbol = Symbol.for(
  '~@polar-sh/polar/EventReference',
)
export const propertyKey: unique symbol = Symbol.for(
  '~@polar-sh/polar/PropertyReference',
)
declare const valueType: unique symbol

export interface EventReference<Name extends string> {
  readonly [eventKey]: Name
}

export interface PropertyReference<Name extends string, Value> {
  readonly [eventKey]: Name
  readonly [propertyKey]: string
  readonly [valueType]?: Value
}

export type PropertyOf<Metadata, Type> = {
  [Key in keyof Metadata]-?: NonNullable<Metadata[Key]> extends Type
    ? Key
    : never
}[keyof Metadata] &
  string

type EventProperties<Name extends string, Metadata> = {
  readonly [Key in PropertyOf<Metadata, Scalar>]-?: PropertyReference<
    Name,
    NonNullable<Metadata[Key]>
  >
}

export type EventReferences<Events extends EventDefinitions> = {
  readonly [Name in keyof Events & string]: EventReference<Name> &
    EventProperties<Name, EventOutput<Events[Name]>>
}

export const isEventReference = (
  value: unknown,
): value is EventReference<string> => Predicate.hasProperty(value, eventKey)

const eventReference = (name: string) =>
  new Proxy(
    { [eventKey]: name },
    {
      get: (target, key) =>
        typeof key === 'symbol'
          ? Reflect.get(target, key)
          : { [eventKey]: name, [propertyKey]: key },
    },
  )

export const createEventReferences = <Events extends EventDefinitions>(
  events: Events,
): EventReferences<Events> =>
  new Proxy({} as EventReferences<Events>, {
    get: (_, name) => {
      if (typeof name !== 'string') return undefined
      if (!Object.hasOwn(events, name)) {
        throw new Error(
          `Unknown event "${name}". Declare it in \`events\` before using it in a meter.`,
        )
      }
      return eventReference(name)
    },
  })
