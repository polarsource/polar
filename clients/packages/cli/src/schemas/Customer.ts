import { AddressInputCountryAlpha2Input } from '@polar-sh/sdk/models/components/addressinput.js'
import { Schema } from 'effect'

export const CustomerCreate = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  billingAddress: Schema.optional(
    Schema.Struct({
      country: Schema.Enum(AddressInputCountryAlpha2Input),
      city: Schema.NullOr(Schema.String),
      state: Schema.NullOr(Schema.String),
    }),
  ),
})

export type CustomerCreate = typeof CustomerCreate.Type
