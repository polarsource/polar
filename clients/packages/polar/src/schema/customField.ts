import { Schema } from 'effect'
import { Builder } from './builder'
import { Metadata, withMetadata, type HasMetadata } from './metadata'

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
    slug: Schema.String.check(Schema.isPattern(/^[a-z0-9-_]+$/)),
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

  placeholder(placeholder: string): this {
    return this.set({ form_placeholder: placeholder })
  }
}

class TextField extends CustomFieldBuilder<'text'> {
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

class RangeField<
  Type extends 'number' | 'date',
> extends CustomFieldBuilder<Type> {
  min(value: number): this {
    return this.set({ ge: value })
  }

  max(value: number): this {
    return this.set({ le: value })
  }
}

class SelectField extends CustomFieldBuilder<'select'> {
  /**
   * The choices, as `{ value: label }` or `[value, label]` entries, in the
   * order they're shown. Use entries when a value looks like an integer:
   * objects list those keys first.
   */
  options(
    options:
      | Readonly<Record<string, string>>
      | ReadonlyArray<readonly [value: string, label: string]>,
  ): this {
    return this.set({
      options: (Array.isArray(options) ? options : Object.entries(options)).map(
        ([value, label]) => ({ value, label }),
      ),
    })
  }
}

export const customFieldHelpers = {
  text: (name?: string) => new TextField(name, 'text'),
  number: (name?: string) => new RangeField(name, 'number'),
  date: (name?: string) => new RangeField(name, 'date'),
  checkbox: (name?: string) => new CustomFieldBuilder(name, 'checkbox'),
  select: (name?: string) => new SelectField(name, 'select'),
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
