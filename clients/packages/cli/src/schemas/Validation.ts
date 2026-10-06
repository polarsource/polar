import { Schema } from 'effect'

export const Loc = Schema.Array(Schema.Union([Schema.String, Schema.Number]))

export const ValidationIssue = Schema.Struct({
  loc: Loc,
  msg: Schema.String,
})

export const bodyPath = (loc: typeof Loc.Type) =>
  loc[0] === 'body' ? loc.slice(1) : loc
