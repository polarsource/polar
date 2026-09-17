import assert from 'node:assert/strict'
import { it } from 'vitest'
import { MalformedResponse, VoidHttpError } from '../src/errors'

it('computes a writable Error.message so hosts can decorate rejections', () => {
  const error = new VoidHttpError({
    status: 404,
    path: '/customers/x',
    code: 'ResourceNotFound',
    detail: 'missing',
  })
  assert.equal(
    error.message,
    'void /customers/x: 404 ResourceNotFound: missing',
  )
  error.message = `${error.message}\n  digest: abc`
  assert.equal(
    error.message,
    'void /customers/x: 404 ResourceNotFound: missing\n  digest: abc',
  )

  const malformed = new MalformedResponse({ path: '/customers/x' })
  assert.equal(malformed.message, 'void /customers/x: malformed response')
  malformed.message = 'decorated'
  assert.equal(malformed.message, 'decorated')
})
