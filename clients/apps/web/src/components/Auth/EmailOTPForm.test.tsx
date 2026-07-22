import { act, render } from '@testing-library/react'
import type { InputHTMLAttributes, PropsWithChildren, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const scriptState = vi.hoisted(() => ({
  onLoad: undefined as (() => void) | undefined,
  onReady: undefined as (() => void) | undefined,
  src: '',
}))

vi.mock('next/script', () => ({
  default: ({
    onLoad,
    onReady,
    src,
  }: {
    onLoad?: () => void
    onReady?: () => void
    src: string
  }) => {
    scriptState.onLoad = onLoad
    scriptState.onReady = onReady
    scriptState.src = src
    return null
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/hooks', () => ({
  useAuthSessionStart: () => ({ mutateAsync: vi.fn() }),
  useEmailOTPRequest: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('@/hooks/posthog', () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}))

vi.mock('@/utils/api/errors', () => ({
  setValidationErrors: vi.fn(),
}))

vi.mock('@polar-sh/client', () => ({
  isValidationError: () => false,
}))

vi.mock('@polar-sh/orbit', () => ({
  Button: ({ children }: PropsWithChildren) => <button>{children}</button>,
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@polar-sh/ui/components/ui/form', () => {
  const Passthrough = ({ children }: PropsWithChildren) => children

  return {
    Form: Passthrough,
    FormControl: Passthrough,
    FormField: ({
      render: renderField,
    }: {
      render: (args: { field: object }) => ReactNode
    }) => renderField({ field: {} }),
    FormItem: Passthrough,
    FormMessage: () => null,
  }
})

import EmailOTPForm from './EmailOTPForm'

const turnstile = {
  remove: vi.fn(),
  render: vi.fn(),
  reset: vi.fn(),
}

describe('EmailOTPForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scriptState.onLoad = undefined
    scriptState.onReady = undefined
    scriptState.src = ''
    turnstile.render
      .mockReturnValueOnce('first-widget')
      .mockReturnValueOnce('second-widget')
    Object.assign(window, { turnstile: undefined })
  })

  it('renders a fresh widget on remount without another script callback', () => {
    const firstRender = render(<EmailOTPForm authenticationSession={null} />)

    expect(scriptState.src).toContain('render=explicit')
    expect(turnstile.render).not.toHaveBeenCalled()

    Object.assign(window, { turnstile })
    act(() => scriptState.onReady?.())
    expect(turnstile.render).toHaveBeenCalledTimes(1)
    expect(turnstile.render.mock.calls[0]?.[1]).toMatchObject({
      action: 'turnstile-spin-v2',
      sitekey: '0x4AAAAAAD7cBrbpX3kX8K9g',
    })

    firstRender.unmount()
    expect(turnstile.remove).toHaveBeenCalledWith('first-widget')

    render(<EmailOTPForm authenticationSession={null} />)

    expect(turnstile.render).toHaveBeenCalledTimes(2)
    expect(turnstile.render.mock.calls[1]?.[0]).not.toBe(
      turnstile.render.mock.calls[0]?.[0],
    )
  })

  it('renders after remounting while the script is still loading', () => {
    const firstRender = render(<EmailOTPForm authenticationSession={null} />)
    firstRender.unmount()

    render(<EmailOTPForm authenticationSession={null} />)
    Object.assign(window, { turnstile })
    act(() => scriptState.onLoad?.())

    expect(turnstile.render).toHaveBeenCalledTimes(1)
  })
})
