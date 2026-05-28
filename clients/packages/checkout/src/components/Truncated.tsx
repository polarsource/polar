'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@polar-sh/ui/components/ui/tooltip'
import { useEffect, useId, useRef, useState } from 'react'

export interface Props {
  children: React.ReactNode
  lines?: number
  tooltip?: React.ReactNode
  className?: string
}

const Truncated = ({ children, lines = 1, tooltip, className }: Props) => {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [shouldRenderTooltip, setShouldRenderTooltip] = useState(false)
  const id = useId()

  useEffect(() => {
    // We only render the tooltip if the content actually overflows
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const overflows = (node: Element) =>
      lines === 1
        ? node.scrollWidth > node.clientWidth
        : node.scrollHeight > node.clientHeight

    const measure = () => {
      let truncated = overflows(el)
      if (!truncated) {
        for (const child of Array.from(el.children)) {
          if (overflows(child)) {
            truncated = true
            break
          }
        }
      }
      setShouldRenderTooltip(truncated)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [lines, children])

  // CSS madness so that we can apply the CSS truncation to the wrapper and its direct children
  const scope = `tr${id.replace(/:/g, '')}`
  const css =
    lines === 1
      ? `.${scope},.${scope}>*{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}`
      : `.${scope},.${scope}>*{display:-webkit-box;-webkit-line-clamp:${lines};-webkit-box-orient:vertical;overflow:hidden;min-width:0}`

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              ref={ref}
              className={className ? `${scope} ${className}` : scope}
              tabIndex={shouldRenderTooltip ? 0 : undefined}
            >
              {children}
            </span>
          </TooltipTrigger>
          {shouldRenderTooltip && (
            <TooltipContent className="max-w-xs">
              {tooltip ?? children}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </>
  )
}

export default Truncated
