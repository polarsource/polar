import '@testing-library/jest-dom/vitest' //extends Vitest's expect method with methods from react-testing-library

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
})
