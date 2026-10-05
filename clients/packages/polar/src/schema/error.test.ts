import { describe, expect, it } from 'vitest'
import { SchemaError } from './error'

describe('SchemaError', () => {
  it('names the subject and the problem', () => {
    const error = new SchemaError('meter', 'key is empty')

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({
      name: 'SchemaError',
      subject: 'meter',
      problem: 'key is empty',
      message: 'meter: key is empty',
    })
  })
})
