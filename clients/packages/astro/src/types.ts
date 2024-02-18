/**
 * A PolarResult contains either the data or an error from a Polar API request.
 */
type PolarResult<T, E extends Error = Error> = {
  data: T,
  error: null
} | {
  data: null,
  error: E
}

/**
 * An ErrorGroup is a collection of errors that are related to a single
 * operation.
 */
class ErrorGroup<E extends Error = Error> extends Error {
  name = 'ErrorGroup'
  errors: E[]

  constructor(errors: E[]) {
    super(`${errors.length} errors occurred.`)
    this.errors = errors
  }
}
