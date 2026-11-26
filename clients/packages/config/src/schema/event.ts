import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Predicate, Schema } from 'effect'
import { Builder } from './builder'

type Scalar = string | number | boolean

export const LLMMetadata = Schema.Struct({
  vendor: Schema.String,
  model: Schema.String,
  prompt: Schema.optionalKey(Schema.NullOr(Schema.String)),
  response: Schema.optionalKey(Schema.NullOr(Schema.String)),
  input_tokens: Schema.Int,
  cached_input_tokens: Schema.optionalKey(Schema.Int),
  output_tokens: Schema.Int,
  total_tokens: Schema.Int,
})

export type LLMMetadata = typeof LLMMetadata.Type

export const CostMetadata = Schema.Struct({
  /** The amount in cents. */
  amount: Schema.Finite,
  currency: Schema.Literal('usd'),
})

export type CostMetadata = typeof CostMetadata.Type

export type EventMetadata = {
  readonly _llm?: LLMMetadata
  readonly _cost?: CostMetadata
  readonly [key: string]: Scalar | LLMMetadata | CostMetadata | undefined
}

export type EventSchema = StandardSchemaV1<unknown, EventMetadata>

export type EventSchemas = Readonly<Record<string, EventSchema>>

export type EventInput<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferInput<Schema>

export type EventOutput<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<Schema>

type ReservedProperty = 'name' | 'source' | 'timestamp' | '_llm' | '_cost'

type InvalidProperty<Metadata> = {
  [Key in keyof Metadata]-?: Key extends ReservedProperty
    ? Key
    : Exclude<Metadata[Key], undefined> extends Scalar
      ? never
      : Key
}[keyof Metadata] &
  string

type ValidSchema<Schema extends StandardSchemaV1> =
  EventOutput<Schema> extends object
    ? [InvalidProperty<EventOutput<Schema>>] extends [never]
      ? Schema
      : `Event metadata property "${InvalidProperty<EventOutput<Schema>>}" is invalid: values must be strings, numbers or booleans, and name, source, timestamp, _llm and _cost are reserved.`
    : 'Events must be described by an object schema.'

type Extension = '_llm' | '_cost'

type Extended<Metadata, Extra> = {
  [Key in keyof (Metadata & Extra)]: (Metadata & Extra)[Key]
}

const extensionSchemas = { _llm: LLMMetadata, _cost: CostMetadata }

type Validation<Output> =
  | StandardSchemaV1.Result<Output>
  | Promise<StandardSchemaV1.Result<Output>>

const then = <Value, Next>(
  value: Value | Promise<Value>,
  next: (value: Value) => Next,
): Next | Promise<Awaited<Next>> =>
  value instanceof Promise
    ? (value.then(next) as Promise<Awaited<Next>>)
    : next(value)

const noMetadata: StandardSchemaV1 = {
  '~standard': { version: 1, vendor: 'polar', validate: () => ({ value: {} }) },
}

export class EventDefinition<
  Input = Record<never, never>,
  Output = Record<never, never>,
>
  extends Builder
  implements StandardSchemaV1<Input, Output>
{
  protected readonly extensions: readonly Extension[] = []

  constructor(protected readonly schema: StandardSchemaV1 = noMetadata) {
    super()
  }

  /** Carries LLM usage in `_llm`, so meters can sum `_llm.input_tokens`, `_llm.output_tokens` or `_llm.total_tokens`. */
  withTokens(): EventDefinition<
    Extended<Input, { readonly _llm: LLMMetadata }>,
    Extended<Output, { readonly _llm: LLMMetadata }>
  > {
    return this.extend('_llm')
  }

  /** Carries what the event cost you in `_cost`, so meters can sum `_cost.amount`. */
  withCosts(): EventDefinition<
    Extended<Input, { readonly _cost: CostMetadata }>,
    Extended<Output, { readonly _cost: CostMetadata }>
  > {
    return this.extend('_cost')
  }

  private extend<Next extends EventDefinition<unknown, unknown>>(
    extension: Extension,
  ): Next {
    return this.with<Next>({
      extensions: this.extensions.includes(extension)
        ? this.extensions
        : [...this.extensions, extension],
    })
  }

  get '~standard'(): StandardSchemaV1.Props<Input, Output> {
    return {
      version: 1,
      vendor: 'polar',
      validate: (value) => this.validate(value) as Validation<Output>,
    }
  }

  private validate(value: unknown): Validation<object> {
    if (this.extensions.length === 0) {
      return this.schema['~standard'].validate(value) as Validation<object>
    }
    if (!Predicate.isObject(value) || Array.isArray(value)) {
      return { issues: [{ message: 'Expected an object' }] }
    }
    const metadata: Record<string, unknown> = { ...value }
    const extensions: Record<string, unknown> = {}
    for (const extension of this.extensions) {
      extensions[extension] = metadata[extension]
      delete metadata[extension]
    }
    const extensionSchema = Schema.toStandardSchemaV1(
      Schema.Struct(
        Object.fromEntries(
          this.extensions.map((extension) => [
            extension,
            extensionSchemas[extension],
          ]),
        ),
      ),
    )
    return then(this.schema['~standard'].validate(metadata), (own) =>
      then(extensionSchema['~standard'].validate(extensions), (extended) => {
        if (own.issues !== undefined || extended.issues !== undefined) {
          return { issues: [...(own.issues ?? []), ...(extended.issues ?? [])] }
        }
        return { value: { ...(own.value as object), ...extended.value } }
      }),
    )
  }
}

export type EventHelpers = {
  /** An event your app sends, described by an object schema. Without one, it has no metadata. */
  readonly event: typeof event
}

export const event: {
  (): EventDefinition
  <const Schema extends StandardSchemaV1>(
    schema: Schema & ValidSchema<Schema>,
  ): EventDefinition<EventInput<Schema>, EventOutput<Schema>>
} = (schema?: StandardSchemaV1) => new EventDefinition(schema)

export type EventDefinitions = Readonly<
  Record<string, EventDefinition<unknown, object>>
>

type Shared<Metadata> = Pick<Metadata, keyof Metadata>

export type SharedEventOutput<
  Events extends EventDefinitions,
  Name extends keyof Events,
> = Shared<EventOutput<Events[Name]>>

export const eventKey: unique symbol = Symbol.for(
  '~@polar-sh/config/EventReference',
)
export const propertyKey: unique symbol = Symbol.for(
  '~@polar-sh/config/PropertyReference',
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
  [Key in keyof Metadata & string]-?: NonNullable<Metadata[Key]> extends Type
    ? Key
    : NonNullable<Metadata[Key]> extends Scalar
      ? never
      : `${Key}.${PropertyOf<NonNullable<Metadata[Key]>, Type>}`
}[keyof Metadata & string]

type EventProperties<Name extends string, Metadata> = {
  readonly [Key in keyof Metadata & string]-?: NonNullable<
    Metadata[Key]
  > extends Scalar
    ? PropertyReference<Name, NonNullable<Metadata[Key]>>
    : EventProperties<Name, NonNullable<Metadata[Key]>>
}

export type EventReferences<Events extends EventDefinitions> = {
  readonly [Name in keyof Events & string]: EventReference<Name> &
    EventProperties<Name, EventOutput<Events[Name]>>
}

export const isEventReference = (
  value: unknown,
): value is EventReference<string> => Predicate.hasProperty(value, eventKey)

const reference = (target: object, path: (key: string) => string): object =>
  new Proxy(target, {
    get: (target, key) =>
      typeof key === 'symbol'
        ? Reflect.get(target, key)
        : propertyReference(Reflect.get(target, eventKey), path(key)),
  })

const propertyReference = (name: string, property: string): object =>
  reference(
    { [eventKey]: name, [propertyKey]: property },
    (key) => `${property}.${key}`,
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
      return reference({ [eventKey]: name }, (key) => key)
    },
  })
