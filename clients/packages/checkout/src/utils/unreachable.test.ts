import { describe, expect, it } from 'vitest'
import { unreachable } from './unreachable'

describe('unreachable', () => {
  it('throws with the value in the message', () => {
    expect(() => unreachable('oops' as never)).toThrow('Unreachable: oops')
  })
})
