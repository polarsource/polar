import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { autoCloseScript, callbackPage } from '@/utils/callback-page'

const fallback = 'You can close this tab.'

const element = (initial: string) => {
  let content = initial
  return {
    get textContent() {
      return content
    },
    set textContent(value: string) {
      content = value
    },
    get innerHTML() {
      return content
    },
    set innerHTML(value: string) {
      content = value
    },
  }
}

const openSuccessPage = (historyLength: number) => {
  const note = element(fallback)
  const window = { close: vi.fn() }
  new Function('history', 'document', 'window', autoCloseScript)(
    { length: historyLength },
    { getElementById: (id: string) => (id === 'note' ? note : null) },
    window,
  )
  return { note, window }
}

describe('callbackPage', () => {
  test.each([
    ['success', 'You are signed in', 'close this tab'],
    ['denied', 'Sign-in canceled', '<code>polar auth login</code>'],
    ['invalid', 'Something went wrong', 'invalid or has expired'],
  ] as const)('renders the %s page', (outcome, title, hint) => {
    const html = callbackPage(outcome)
    expect(html).toContain(`<h1>${title}</h1>`)
    expect(html).toContain(hint)
  })

  test('keeps the instruction and the closing note on one line', () => {
    expect(callbackPage('success')).toContain(
      '<p>Return to your terminal to continue. <span id="note">You can close this tab.</span></p>',
    )
  })

  test('fades and scales the logo in unless reduced motion is requested', () => {
    const html = callbackPage('success')
    expect(html).toContain('animation: appear')
    expect(html).toContain('from { opacity: 0; transform: scale(0.9); }')
    expect(html).toContain(
      '@media (prefers-reduced-motion: reduce) { svg { animation: none; } }',
    )
  })

  test('embeds the closing script in the success page', () => {
    expect(callbackPage('success')).toContain(
      `<script>\n${autoCloseScript}\n</script>`,
    )
  })

  test.each(['denied', 'invalid'] as const)(
    'never closes the %s page',
    (outcome) => {
      expect(callbackPage(outcome)).not.toContain('<script')
    },
  )
})

describe('closing the tab after sign-in', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('counts down and closes a tab the browser allows it to close', () => {
    const { note, window } = openSuccessPage(1)

    for (const seconds of [5, 4, 3, 2, 1]) {
      expect(note.innerHTML).toBe(
        `Closing this tab in <span class='seconds'>${seconds}</span>…`,
      )
      expect(window.close).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1000)
    }
    expect(window.close).toHaveBeenCalledOnce()
  })

  test('sets the remaining seconds in a monospace font', () => {
    const { note } = openSuccessPage(1)

    expect(note.innerHTML).toBe(
      "Closing this tab in <span class='seconds'>5</span>…",
    )
    expect(callbackPage('success')).toMatch(
      /\.seconds \{[^}]*font-family: ui-monospace/,
    )
  })

  test('asks to close the tab by hand when the browser refuses', () => {
    const { note } = openSuccessPage(1)

    vi.advanceTimersByTime(5000)
    vi.advanceTimersByTime(300)
    expect(note.innerHTML).toBe(fallback)
  })

  test('promises nothing when the tab has history and cannot be closed', () => {
    const { note, window } = openSuccessPage(2)

    vi.advanceTimersByTime(10_000)
    expect(note.innerHTML).toBe(fallback)
    expect(window.close).not.toHaveBeenCalled()
  })
})
