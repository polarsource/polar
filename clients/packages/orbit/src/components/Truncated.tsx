'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { Box } from './Box'
import { useEffect, useRef, useState, useId } from 'react'
import { Text } from './Text'

export interface Props {
  children: React.ReactNode
  lines?: number
  tooltip?: React.ReactNode
  className?: string
}

export const Truncated = ({
  children,
  lines = 1,
  tooltip,
  className,
}: Props) => {
  const ref = useRef<HTMLElement | null>(null)
  const [shouldRenderTooltip, setShouldRenderTooltip] = useState(false)
  const id = useId()

  useEffect(() => {
    // We only render the tooltip if the content actually overflows
    const el = ref.current
    if (!el) return

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
      <TooltipPrimitive.Provider delayDuration={200}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>
            <Box
              ref={ref as React.Ref<HTMLElement>}
              as="span"
              className={className ? `${scope} ${className}` : scope}
              tabIndex={shouldRenderTooltip ? 0 : undefined}
            >
              {children}
            </Box>
          </TooltipPrimitive.Trigger>
          {shouldRenderTooltip && (
            <TooltipPrimitive.Portal>
              <TooltipPrimitive.Content sideOffset={4} style={{ zIndex: 50 }}>
                {tooltip ?? (
                  <Box
                    backgroundColor="background-card"
                    color="text-primary"
                    borderColor="border-primary"
                    borderWidth={1}
                    borderStyle="solid"
                    borderRadius="s"
                    paddingHorizontal="m"
                    paddingVertical="s"
                    boxShadow="m"
                    maxWidth={320}
                  >
                    <Text>{children}</Text>
                  </Box>
                )}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          )}
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    </>
  )
}
