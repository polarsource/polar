import { afterEach, describe, expect, test, vi } from 'vitest'
import { Console, Effect } from 'effect'
import { renderEvent } from '@/commands/listen'
import type { ListenEvent } from '@/services/listen'
import { captureConsole, stripAnsi } from '@/utils/test-utils/cli'

describe('renderEvent', () => {
  const render = (event: ListenEvent) => {
    const { lines, console } = captureConsole()
    const errors: string[] = []
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      errors.push(stripAnsi(String(chunk)))
      return true
    })
    Effect.runSync(
      renderEvent(
        'Acme',
        'http://localhost:3000/webhook',
      )(event).pipe(Effect.provideService(Console.Console, console)),
    )
    return { output: lines.join('\n'), errors: errors.join('') }
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows the organization, forward URL and signing secret on connect', () => {
    const { output, errors } = render({
      _tag: 'Connected',
      secret: 'whsec_test',
    })
    expect(output).toContain('Connected  Acme')
    expect(output).toContain('http://localhost:3000/webhook')
    expect(output).toContain('whsec_test')
    expect(errors).toBe('')
  })

  test('prints a forwarded event with its status and duration', () => {
    const { output } = render({
      _tag: 'Forwarded',
      eventType: 'order.created',
      status: 200,
      statusText: 'OK',
      durationMs: 12.4,
    })
    expect(output).toContain('order.created')
    expect(output).toContain('200 OK')
    expect(output).toContain('12ms')
  })

  test('reports a failed forward on stderr', () => {
    const { output, errors } = render({
      _tag: 'ForwardFailed',
      eventType: 'order.paid',
      reason: 'connection refused, is your server running?',
      durationMs: 3,
    })
    expect(errors).toContain('order.paid')
    expect(errors).toContain(
      'failed  connection refused, is your server running?',
    )
    expect(output).toBe('')
  })

  test('reports an undecodable event on stderr with its key', () => {
    expect(render({ _tag: 'Undecodable', key: 'mystery' }).errors).toContain(
      'Event key: mystery',
    )
    expect(render({ _tag: 'Undecodable', key: undefined }).errors).toContain(
      'Event key: unknown',
    )
  })
})
