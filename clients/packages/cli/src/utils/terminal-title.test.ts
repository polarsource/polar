import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Effect, Stdio } from 'effect'
import { withTerminalTitle } from '@/utils/terminal-title'
import * as ui from '@/utils/ui'

describe('withTerminalTitle', () => {
  let writes: string[]

  beforeEach(() => {
    writes = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk))
      return true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const run = <A, E>(effect: Effect.Effect<A, E>, terminal: boolean) =>
    Effect.runPromise(
      withTerminalTitle('polar listen · Acme', effect).pipe(
        Effect.provide(
          Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(terminal) }),
        ),
        Effect.result,
      ),
    )

  test('sets the title while running and restores it afterwards', async () => {
    await run(Effect.void, true)
    expect(writes).toEqual([ui.pushTitle('polar listen · Acme'), ui.popTitle])
  })

  test('restores the title when listening fails', async () => {
    await run(Effect.fail('stream closed'), true)
    expect(writes.at(-1)).toBe(ui.popTitle)
  })

  test('leaves the title alone outside a terminal', async () => {
    await run(Effect.void, false)
    expect(writes).toEqual([])
  })
})
