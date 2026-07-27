'use client'

import { useCallback, useEffect, useRef } from 'react'

// Within this distance of the bottom the view counts as "at the bottom", so
// minor offsets (block padding, momentum overshoot) don't break following.
const STICK_THRESHOLD_PX = 80

const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
  let node = el?.parentElement ?? null
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    // Match on overflow intent, not current scrollability: a short thread's
    // container doesn't overflow yet at mount, but it is still the element
    // that must be followed once streaming makes it overflow.
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return node
    }
    node = node.parentElement
  }
  return (document.scrollingElement as HTMLElement | null) ?? null
}

/**
 * Keep a scroll container pinned to the bottom while `contentRef`'s subtree
 * grows (streamed text, blocks, charts settling their height), without
 * fighting the user:
 *
 * - Following only happens while the view is already at the bottom; scrolling
 *   up detaches it, scrolling back down re-attaches. Programmatic scrolls
 *   land at distance 0, so they never detach it themselves.
 * - Growth is observed with a ResizeObserver rather than React state, so
 *   late-settling content (charts, images) is followed too, and scroll
 *   writes are coalesced to at most one per animation frame regardless of
 *   how fast deltas stream in.
 */
export const useStickToBottom = <T extends HTMLElement>() => {
  const contentRef = useRef<T | null>(null)
  const scrollerRef = useRef<HTMLElement | null>(null)
  const stickRef = useRef(true)
  const frameRef = useRef<number | null>(null)

  const scheduleScroll = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const scroller = scrollerRef.current
      if (scroller && stickRef.current) {
        scroller.scrollTop = scroller.scrollHeight
      }
    })
  }, [])

  useEffect(() => {
    const content = contentRef.current
    const scroller = findScrollParent(content)
    if (!content || !scroller) return
    scrollerRef.current = scroller

    const onScroll = () => {
      const distance =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      stickRef.current = distance < STICK_THRESHOLD_PX
    }
    const scrollTarget =
      scroller === document.scrollingElement ? window : scroller
    scrollTarget.addEventListener('scroll', onScroll, { passive: true })

    const observer = new ResizeObserver(scheduleScroll)
    observer.observe(content)

    return () => {
      scrollTarget.removeEventListener('scroll', onScroll)
      observer.disconnect()
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [scheduleScroll])

  /** Force-follow again, e.g. when the user sends a message. */
  const scrollToBottom = useCallback(() => {
    stickRef.current = true
    scheduleScroll()
  }, [scheduleScroll])

  return { contentRef, scrollToBottom }
}
