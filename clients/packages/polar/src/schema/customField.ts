import { Schema } from 'effect'
import { Builder } from './builder'
import { Metadata, withMetadata, type HasMetadata } from './metadata'

export const SLUG = /^[a-z0-9-_]+$/

const NonEmpty = Schema.String.check(Schema.isMinLength(1))
const Int32 = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(-2147483648),
  Schema.isLessThanOrEqualTo(2147483647),
)
const Length = Int32.check(Schema.isGreaterThanOrEqualTo(0))

const formFields = {
  form_label: Schema.optionalKey(NonEmpty),
  form_help_text: Schema.optionalKey(NonEmpty),
  form_placeholder: Schema.optionalKey(NonEmpty),
}

const range = { ge: Schema.optionalKey(Int32), le: Schema.optionalKey(Int32) }

const fieldOf = <const Type extends string, Properties extends Schema.Top>(
  type: Type,
  properties: Properties,
) =>
  Schema.Struct({
    type: Schema.Literal(type),
    slug: Schema.String.check(Schema.isPattern(SLUG)),
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
    }),
  ),
  fieldOf('number', Schema.Struct({ ...formFields, ...range })),
  fieldOf('date', Schema.Struct({ ...formFields, ...range })),
  fieldOf('checkbox', Schema.Struct(formFields)),
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
type Properties = Record<string, unknown>

export type CustomFieldDefinition = {
  readonly name: string | undefined
  readonly type: CustomFieldType
  readonly properties: Properties
} & HasMetadata

class CustomFieldBuilder<Type extends CustomFieldType> extends withMetadata(
  Builder,
) {
  constructor(
    readonly name: string | undefined,
    readonly type: Type,
    readonly properties: Properties = {},
  ) {
    super()
  }

  protected set(properties: Properties): this {
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
  /** Asks with a multi-line text area. */
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
  const time = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? Date.parse(`${date}T00:00:00Z`)
    : Number.NaN
  if (
    Number.isNaN(time) ||
    new Date(time).toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Invalid date "${String(date)}", use YYYY-MM-DD.`)
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

class SelectField extends InputField<'select'> {}

type SelectOptions =
  | Readonly<Record<string, string>>
  | ReadonlyArray<readonly [value: string, label: string]>

/**
 * A dropdown. Its choices are `{ value: label }` or `[value, label]` entries,
 * in the order they're shown. Use entries when a value looks like an integer:
 * objects list those keys first.
 */
function select(options: SelectOptions): SelectField
function select(name: string, options: SelectOptions): SelectField
function select(
  ...args: [SelectOptions] | [string, SelectOptions]
): SelectField {
  const [name, options] = args.length === 1 ? [undefined, args[0]] : args
  return new SelectField(name, 'select', {
    options: (Array.isArray(options) ? options : Object.entries(options)).map(
      ([value, label]) => ({ value, label }),
    ),
  })
}

export const customFieldHelpers = {
  text: (name?: string) => new TextField(name, 'text'),
  number: (name?: string) => new NumberField(name, 'number'),
  date: (name?: string) => new DateField(name, 'date'),
  checkbox: (name?: string) => new CustomFieldBuilder(name, 'checkbox'),
  select,
}

export type CustomFieldHelpers = typeof customFieldHelpers

export type RequiredField<Slug extends string = string> = {
  readonly field: Slug
  readonly required: true
}

/** Marks a custom field in `.customFields([...])` as required at checkout. */
export const required = <const Slug extends string>(
  field: Slug,
): RequiredField<Slug> => ({ field, required: true })
