import { Schema } from 'effect'
import { Builder } from './builder'
import { Metadata, withMetadata, type HasMetadata } from './metadata'

const NonEmpty = Schema.String.check(Schema.isMinLength(1))
const Int32 = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(-2147483648),
  Schema.isLessThanOrEqualTo(2147483647),
)
const Length = Int32.check(Schema.isGreaterThanOrEqualTo(0))

export const Slug = Schema.String.check(
  Schema.isPattern(/^[a-z0-9-_]+$/, {
    message: 'Use only lowercase letters, digits, "-" and "_"',
  }),
)

const formFields = {
  form_label: Schema.optionalKey(NonEmpty),
  form_help_text: Schema.optionalKey(NonEmpty),
  form_placeholder: Schema.optionalKey(NonEmpty),
}
const FormProperties = Schema.Struct(formFields)

const RangeProperties = Schema.Struct({
  ...formFields,
  ge: Schema.optionalKey(Int32),
  le: Schema.optionalKey(Int32),
}).check(
  Schema.makeFilter(({ ge, le }) =>
    ge === undefined || le === undefined || ge <= le
      ? undefined
      : { path: ['le'], issue: 'The max must not be before the min' },
  ),
)

const fieldOf = <const Type extends string, Properties extends Schema.Top>(
  type: Type,
  properties: Properties,
) =>
  Schema.Struct({
    type: Schema.Literal(type),
    slug: Slug,
    name: NonEmpty,
    properties,
    metadata: Schema.optionalKey(Metadata),
  })

export const CustomFieldConfig = Schema.Union([
  fieldOf(
    'text',
    Schema.Struct({
      ...formFields,
      textarea: Schema.optionalKey(Schema.Boolean),
      min_length: Schema.optionalKey(Length),
      max_length: Schema.optionalKey(Length),
    }).check(
      Schema.makeFilter(({ min_length, max_length }) =>
        min_length === undefined ||
        max_length === undefined ||
        min_length <= max_length
          ? undefined
          : {
              path: ['max_length'],
              issue: 'The max length must not be less than the min length',
            },
      ),
    ),
  ),
  fieldOf('number', RangeProperties),
  fieldOf('date', RangeProperties),
  fieldOf('checkbox', FormProperties),
  fieldOf(
    'select',
    Schema.Struct({
      ...formFields,
      options: Schema.Array(
        Schema.Struct({ value: NonEmpty, label: NonEmpty }),
      ).check(Schema.isMinLength(1)),
    }),
  ),
])

export type CustomFieldConfig = typeof CustomFieldConfig.Type

type CustomFieldType = CustomFieldConfig['type']
type PropertiesOf<Type extends CustomFieldType> = Extract<
  CustomFieldConfig,
  { readonly type: Type }
>['properties']

export type CustomFieldDefinition = {
  [Type in CustomFieldType]: {
    readonly name: string | undefined
    readonly type: Type
    readonly properties: PropertiesOf<Type>
  } & HasMetadata
}[CustomFieldType]

class CustomFieldBuilder<Type extends CustomFieldType> extends withMetadata(
  Builder,
) {
  constructor(
    readonly name: string | undefined,
    readonly type: Type,
    readonly properties: PropertiesOf<Type>,
  ) {
    super()
  }

  protected set(
    properties: typeof FormProperties.Type | Partial<PropertiesOf<Type>>,
  ): this {
    return this.with({ properties: { ...this.properties, ...properties } })
  }

  /** The label shown on the checkout form, instead of the field's name. */
  label(label: string): this {
    return this.set({ form_label: label })
  }

  help(text: string): this {
    return this.set({ form_help_text: text })
  }
}

class InputField<
  Type extends 'text' | 'number' | 'date' | 'select',
> extends CustomFieldBuilder<Type> {
  /** The hint shown in the empty input. */
  placeholder(placeholder: string): this {
    return this.set({ form_placeholder: placeholder })
  }
}

class TextField extends InputField<'text'> {
  /** Uses a multi-line text area instead of a single-line input. */
  textarea(): this {
    return this.set({ textarea: true })
  }

  minLength(length: number): this {
    return this.set({ min_length: length })
  }

  maxLength(length: number): this {
    return this.set({ max_length: length })
  }
}

class NumberField extends InputField<'number'> {
  min(value: number): this {
    return this.set({ ge: value })
  }

  max(value: number): this {
    return this.set({ le: value })
  }
}

/** A calendar day, like `'2026-01-31'`. */
type CalendarDate = `${number}-${number}-${number}`

// Checkout compares calendar days in UTC, so a day is stored as its UTC midnight.
const timestamp = (date: CalendarDate): number => {
  const time = Date.parse(`${date}T00:00:00Z`)
  if (
    Number.isNaN(time) ||
    new Date(time).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Invalid date "${date}", use YYYY-MM-DD.`)
  }
  return time / 1000
}

class DateField extends InputField<'date'> {
  /** The earliest day accepted, like `'2026-01-31'`. */
  min(date: CalendarDate): this {
    return this.set({ ge: timestamp(date) })
  }

  /** The latest day accepted, like `'2026-12-31'`. */
  max(date: CalendarDate): this {
    return this.set({ le: timestamp(date) })
  }
}

type SelectOptions =
  | Readonly<Record<string, string>>
  | ReadonlyArray<readonly [value: string, label: string]>

/**
 * Asks with a dropdown. Its choices are `{ value: label }` or `[value, label]`
 * entries, in the order they're shown. Use entries when a value looks like an
 * integer: objects list those keys first. The name defaults to its key in
 * `customFields`.
 */
export const select = (
  ...args: [options: SelectOptions] | [name: string, options: SelectOptions]
): InputField<'select'> => {
  const [name, options] = args.length === 1 ? [undefined, args[0]] : args
  return new InputField(name, 'select', {
    options: (Array.isArray(options) ? options : Object.entries(options)).map(
      ([value, label]) => ({ value, label }),
    ),
  })
}

/** Asks for text. The name defaults to its key in `customFields`. */
export const text = (name?: string): TextField =>
  new TextField(name, 'text', {})

/** Asks for a number. The name defaults to its key in `customFields`. */
export const number = (name?: string): NumberField =>
  new NumberField(name, 'number', {})

/** Asks for a calendar day. The name defaults to its key in `customFields`. */
export const date = (name?: string): DateField =>
  new DateField(name, 'date', {})

/** Asks with a checkbox. If required, the customer must tick it. The name defaults to its key in `customFields`. */
export const checkbox = (name?: string): CustomFieldBuilder<'checkbox'> =>
  new CustomFieldBuilder(name, 'checkbox', {})

export type CustomFieldHelpers = {
  /** Asks for text. The name defaults to its key in `customFields`. */
  readonly text: typeof text
  /** Asks for a number. The name defaults to its key in `customFields`. */
  readonly number: typeof number
  /** Asks for a calendar day. The name defaults to its key in `customFields`. */
  readonly date: typeof date
  /** Asks with a checkbox. If required, the customer must tick it. The name defaults to its key in `customFields`. */
  readonly checkbox: typeof checkbox
  /** Asks with a dropdown of `{ value: label }` or `[value, label]` choices, in the order they're shown. The name defaults to its key in `customFields`. */
  readonly select: typeof select
}

export type OptionalField<Slug extends string = string> = {
  readonly field: Slug
  readonly required: false
}

export const optional = <const Slug extends string>(
  field: Slug,
): OptionalField<Slug> => ({ field, required: false })
