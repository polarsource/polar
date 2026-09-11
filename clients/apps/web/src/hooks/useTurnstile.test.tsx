import { act, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTurnstile } from './useTurnstile'

interface RenderOptions {
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
}

const WIDGET_ID = 'widget-1'

let renderOptions: RenderOptions
const turnstileMock = {
  render: vi.fn((_container: HTMLElement, options: RenderOptions) => {
    renderOptions = options
    return WIDGET_ID
  }),
  execute: vi.fn(),
  reset: vi.fn(),
  remove: vi.fn(),
}

type Turnstile = ReturnType<typeof useTurnstile>

let turnstile: Turnstile

const Harness = () => {
  const hook = useTurnstile('test-action')
  const { containerRef } = hook
  useEffect(() => {
    turnstile = hook
  }, [hook])
  return <div ref={containerRef} />
}

beforeEach(() => {
  Object.assign(window, { turnstile: turnstileMock })
})

afterEach(() => {
  vi.clearAllMocks()
  Reflect.deleteProperty(window, 'turnstile')
})

describe('useTurnstile', () => {
  it('resolves with the token issued by the challenge', async () => {
    render(<Harness />)

    act(() => turnstile.execute())
    expect(turnstileMock.execute).toHaveBeenCalledTimes(1)

    act(() => renderOptions.callback!('token-1'))

    await expect(turnstile.getToken()).resolves.toBe('token-1')
    expect(turnstileMock.execute).toHaveBeenCalledTimes(1)
  })

  it('runs a fresh challenge after the token expires', async () => {
    render(<Harness />)

    act(() => turnstile.execute())
    act(() => renderOptions.callback!('token-1'))
    act(() => renderOptions['expired-callback']!())

    expect(turnstileMock.reset).toHaveBeenCalledWith(WIDGET_ID)

    const token = turnstile.getToken()
    expect(turnstileMock.execute).toHaveBeenCalledTimes(2)

    act(() => renderOptions.callback!('token-2'))
    await expect(token).resolves.toBe('token-2')
  })

  it('fails a pending submit on error and re-arms for the next one', async () => {
    render(<Harness />)

    act(() => turnstile.execute())

    const failed = turnstile.getToken()
    act(() => renderOptions['error-callback']!())
    await expect(failed).resolves.toBeNull()

    const token = turnstile.getToken()
    expect(turnstileMock.execute).toHaveBeenCalledTimes(2)

    act(() => renderOptions.callback!('token-2'))
    await expect(token).resolves.toBe('token-2')
  })

  it('times out when the challenge never settles', async () => {
    vi.useFakeTimers()
    try {
      render(<Harness />)

      const token = turnstile.getToken()
      await act(async () => {
        vi.advanceTimersByTime(15000)
      })

      await expect(token).resolves.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
