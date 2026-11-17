import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, expect, vi } from 'vitest'

declare global {
  var __vitest_mocker__: { reset: () => void } | undefined
}

const moduleMocker = globalThis.__vitest_mocker__
if (!moduleMocker) {
  throw new Error(
    'vitest no longer exposes __vitest_mocker__: vi.mock() registrations would leak between test files under isolate: false',
  )
}

const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')
const resetDocument = () => {
  if (locationDescriptor) {
    Object.defineProperty(window, 'location', locationDescriptor)
  }
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  for (const element of [document.documentElement, document.body]) {
    for (const { name } of Array.from(element.attributes)) {
      element.removeAttribute(name)
    }
  }
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0].trim()
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
  }
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.history.replaceState(null, '', '/')
}

expect.extend(matchers)

afterEach(cleanup)

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  resetDocument()
  moduleMocker.reset()
  vi.resetModules()
})
