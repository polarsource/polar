const isBrowser = typeof window !== 'undefined' && window.document && window.document.createElement

function supportsTouchEvents(): boolean {
  return isBrowser && 'ontouchstart' in window
}

function isTouchScreen(): boolean {
  return supportsTouchEvents() || (isBrowser && window.navigator.maxTouchPoints > 1)
}

function supportsPointerEvents(): boolean {
  return isBrowser && 'onpointerdown' in window
}

function supportsPointerLock(): boolean {
  return isBrowser && 'exitPointerLock' in window.document
}

function supportsGestureEvents(): boolean {
  try {
    // TODO [TS] possibly find GestureEvent definitions?
    // @ts-ignore: no type definitions for webkit GestureEvents
    return 'constructor' in GestureEvent
  } catch (e) {
    return false
  }
}

export const SUPPORT = {
  isBrowser,
  gesture: supportsGestureEvents(),
  /**
   * It looks from https://github.com/pmndrs/use-gesture/discussions/421 that
   * some touchscreens using webkits don't have 'ontouchstart' in window. So
   * we're considering that browsers support TouchEvent if they have
   * `maxTouchPoints > 1`
   *
   * Update 16/09/2023: This generates failure on other Windows systems, so reverting
   * back to detecting TouchEvent support only.
   * https://github.com/pmndrs/use-gesture/issues/626
   */
  touch: supportsTouchEvents(),
  // touch: isTouchScreen(),
  touchscreen: isTouchScreen(),
  pointer: supportsPointerEvents(),
  pointerLock: supportsPointerLock()
}
