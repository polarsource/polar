import { Schema } from 'effect'

/** The server answered with a non-2xx status and its `{ error, detail }` envelope. */
export class VoidHttpError extends Schema.TaggedError<VoidHttpError>()(
  'VoidHttpError',
  {
    status: Schema.Number,
    path: Schema.String,
    code: Schema.String,
    detail: Schema.Unknown,
  },
) {
  get message() {
    const detail =
      typeof this.detail === 'string'
        ? this.detail
        : JSON.stringify(this.detail)
    return `void ${this.path}: ${this.status} ${this.code}: ${detail}`
  }
  get notFound() {
    return this.status === 404
  }
}

/** A 2xx response that did not match the generated wire schema. */
export class MalformedResponse extends Schema.TaggedError<MalformedResponse>()(
  'MalformedResponse',
  { path: Schema.String, cause: Schema.optionalKey(Schema.Unknown) },
) {
  get message() {
    return `void ${this.path}: malformed response`
  }
}

/** Everything the SDK decides on its own, before or instead of a request. */
export class VoidError extends Schema.TaggedError<VoidError>()('VoidError', {
  reason: Schema.Literals([
    'unreachable',
    'not_deployed',
    'not_in_config',
    'parent_mismatch',
    'invalid_argument',
    'no_scope',
    'event_storage',
    'reconciliation',
    'denied',
  ]),
  message: Schema.String,
  cause: Schema.optionalKey(Schema.Defect()),
}) {}
