import { act } from '@testing-library/react'

interface Viewport {
  width: number
  coarsePointer: boolean
}

const DEFAULT_VIEWPORT: Viewport = { width: 1280, coarsePointer: false }
const ROOT_FONT_SIZE = 16

const viewport: Viewport = { ...DEFAULT_VIEWPORT }
const mediaQueryListeners = new Set<() => void>()

const resizeEntry = (target: Element): ResizeObserverEntry => {
  const contentRect = target.getBoundingClientRect()
  const size = [
    { inlineSize: contentRect.width, blockSize: contentRect.height },
  ]
  return {
    target,
    contentRect,
    borderBoxSize: size,
    contentBoxSize: size,
    devicePixelContentBoxSize: size,
  }
}

class FakeResizeObserver {
  static instances = new Set<FakeResizeObserver>()

  private readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.targets.add(target)
    FakeResizeObserver.instances.add(this)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
    FakeResizeObserver.instances.delete(this)
  }

  notify() {
    this.callback(
      Array.from(this.targets, resizeEntry),
      this as unknown as ResizeObserver,
    )
  }
}

const toPixels = (value: string, unit: string): number =>
  unit === 'rem' ? Number(value) * ROOT_FONT_SIZE : Number(value)

const matchesQuery = (query: string): boolean => {
  const minWidth = query.match(/\(min-width:\s*([\d.]+)(px|rem)\)/)
  if (minWidth) {
    return viewport.width >= toPixels(minWidth[1], minWidth[2])
  }
  const maxWidth = query.match(/\(max-width:\s*([\d.]+)(px|rem)\)/)
  if (maxWidth) {
    return viewport.width <= toPixels(maxWidth[1], maxWidth[2])
  }
  if (query.includes('pointer: coarse')) {
    return viewport.coarsePointer
  }
  if (query.includes('pointer: fine')) {
    return !viewport.coarsePointer
  }
  return false
}

export const installViewport = () => {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return matchesQuery(query)
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, listener: () => void) => {
        mediaQueryListeners.add(listener)
      },
      removeEventListener: (_: string, listener: () => void) => {
        mediaQueryListeners.delete(listener)
      },
      addListener: (listener: () => void) => {
        mediaQueryListeners.add(listener)
      },
      removeListener: (listener: () => void) => {
        mediaQueryListeners.delete(listener)
      },
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
  globalThis.ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver
}

export const triggerResize = () => {
  act(() => {
    FakeResizeObserver.instances.forEach((observer) => observer.notify())
  })
}

export const setViewport = (next: Partial<Viewport>) => {
  Object.assign(viewport, next)
  act(() => {
    mediaQueryListeners.forEach((listener) => listener())
    FakeResizeObserver.instances.forEach((observer) => observer.notify())
  })
}

export const resetViewport = () => {
  Object.assign(viewport, DEFAULT_VIEWPORT)
  mediaQueryListeners.clear()
  FakeResizeObserver.instances.clear()
}
