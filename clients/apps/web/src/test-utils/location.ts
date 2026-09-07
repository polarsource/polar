import { onTestFinished, vi, type Mock } from 'vitest'

export const stubLocationReload = (): Mock<() => void> => {
  const original = window.location
  const descriptor = Object.getOwnPropertyDescriptor(window, 'location')
  if (!descriptor) {
    throw new Error(
      'window.location is not an own property in this environment',
    )
  }
  const reload = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: original.href,
      origin: original.origin,
      protocol: original.protocol,
      host: original.host,
      hostname: original.hostname,
      port: original.port,
      pathname: original.pathname,
      search: original.search,
      hash: original.hash,
      assign: vi.fn(),
      replace: vi.fn(),
      reload,
      toString: () => original.href,
    },
  })
  onTestFinished(() => {
    Object.defineProperty(window, 'location', descriptor)
  })
  return reload
}
