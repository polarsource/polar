'use client'

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const BOTTOM_THRESHOLD = 48
const SCROLLBAR_RESTORE_DELAY = 400

export interface ScrollFadeHandle {
  isAtBottom: () => boolean
}

interface ScrollFadeProps {
  children: React.ReactNode
  className?: string
  fadeSize?: number
  stickToBottom?: boolean
  scrollToBottomSignal?: number
  ref?: React.Ref<ScrollFadeHandle>
}

export const ScrollFade = ({
  children,
  className,
  fadeSize = 24,
  stickToBottom = false,
  scrollToBottomSignal,
  ref,
}: ScrollFadeProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      isAtBottom: () => {
        const el = viewportRef.current
        if (!el) return true
        return (
          el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
        )
      },
    }),
    [],
  )

  const stickRef = useRef(true)
  const scrollbarRestoreTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const [showTop, setShowTop] = useState(false)
  const [showBottom, setShowBottom] = useState(false)

  const recompute = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setShowTop(el.scrollTop > 1)
    setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  const scrollToBottomQuietly = useCallback((el: HTMLDivElement) => {
    if (el.offsetWidth === el.clientWidth) {
      el.style.setProperty('scrollbar-width', 'none')
      if (scrollbarRestoreTimer.current) {
        clearTimeout(scrollbarRestoreTimer.current)
      }
      scrollbarRestoreTimer.current = setTimeout(() => {
        el.style.removeProperty('scrollbar-width')
      }, SCROLLBAR_RESTORE_DELAY)
    }
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(
    () => () => {
      if (scrollbarRestoreTimer.current) {
        clearTimeout(scrollbarRestoreTimer.current)
      }
    },
    [],
  )

  const handleScroll = useCallback(() => {
    recompute()
    const el = viewportRef.current
    if (stickToBottom && el) {
      stickRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD
    }
  }, [recompute, stickToBottom])

  const handleResize = useCallback(() => {
    const el = viewportRef.current
    if (stickToBottom && el && stickRef.current) {
      scrollToBottomQuietly(el)
    }
    recompute()
  }, [recompute, stickToBottom, scrollToBottomQuietly])

  useIsomorphicLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    handleResize()
    const observer = new ResizeObserver(handleResize)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [handleResize])

  useEffect(() => {
    if (!scrollToBottomSignal) return
    const el = viewportRef.current
    if (!el) return
    stickRef.current = true
    scrollToBottomQuietly(el)
    recompute()
  }, [scrollToBottomSignal, recompute, scrollToBottomQuietly])

  const top = showTop ? `${fadeSize}px` : '0px'
  const bottom = showBottom ? `calc(100% - ${fadeSize}px)` : '100%'
  const mask = `linear-gradient(to bottom, transparent, black ${top}, black ${bottom}, transparent)`

  return (
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      className={twMerge('overflow-y-auto', className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  )
}
