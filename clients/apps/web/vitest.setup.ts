import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, expect } from 'vitest'
import { server } from './src/test-utils/server'
import { installViewport, resetViewport } from './src/test-utils/viewport'

expect.extend(matchers)
installViewport()
server.listen({ onUnhandledRequest: 'error' })

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetViewport()
})

afterAll(() => server.close())
