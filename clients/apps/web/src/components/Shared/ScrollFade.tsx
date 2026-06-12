'use client'

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { twMerge } from 'tailwind-merge'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

const BOTTOM_THRESHOLD = 48

interface ScrollFadeProps {
  children: React.ReactNode
  className?: string
  fadeSize?: number
  stickToBottom?: boolean
}

export const ScrollFade = ({
  children,
  className,
  fadeSize = 24,
  stickToBottom = false,
}: ScrollFadeProps) => {
  const viewportRef = useRef<HTMLDivElement>(null)

  const stickRef = useRef(true)
  const [showTop, setShowTop] = useState(false)
  const [showBottom, setShowBottom] = useState(false)

  const recompute = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    setShowTop(el.scrollTop > 1)
    setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

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
      el.scrollTop = el.scrollHeight
    }
    recompute()
  }, [recompute, stickToBottom])

  useIsomorphicLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    handleResize()
    const observer = new ResizeObserver(handleResize)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [handleResize])

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
