'use client'

import React, { useId } from 'react'
import { resolveBoxStyles, BOX_STYLE_PROP_KEYS } from './resolvers'
import type { BoxStyleProps } from './types'

type BoxElement =
  | 'div' | 'span' | 'section' | 'article' | 'aside' | 'main'
  | 'nav' | 'header' | 'footer' | 'form' | 'fieldset' | 'label'
  | 'ul' | 'ol' | 'li'

type BoxOwnProps<E extends BoxElement = 'div'> = BoxStyleProps & {
  as?: E
  className?: string
  children?: React.ReactNode
}

export type BoxProps<E extends BoxElement = 'div'> = BoxOwnProps<E> &
  Omit<React.ComponentPropsWithoutRef<E>, keyof BoxOwnProps<E>>

function BoxInner<E extends BoxElement = 'div'>(
  { as, className, children, style: styleProp, ...rest }: BoxProps<E> & { style?: React.CSSProperties },
  ref: React.ForwardedRef<HTMLElement>,
) {
  const id = useId()
  const scopeClass = `ds${id.replace(/:/g, '')}`
  const Component = (as || 'div') as React.ElementType

  const styleProps: Record<string, unknown> = {}
  const domProps: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(rest)) {
    if (BOX_STYLE_PROP_KEYS.has(key)) {
      styleProps[key] = value
    } else {
      domProps[key] = value
    }
  }

  const { style, responsiveCSS } = resolveBoxStyles(styleProps as BoxStyleProps, scopeClass)
  const mergedStyle = styleProp ? { ...style, ...styleProp } : style
  const hasStyle = Object.keys(mergedStyle).length > 0
  const classes = [responsiveCSS ? scopeClass : null, className].filter(Boolean).join(' ') || undefined

  return (
    <>
      {responsiveCSS && <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />}
      <Component
        ref={ref}
        className={classes}
        style={hasStyle ? mergedStyle : undefined}
        {...domProps}
      >
        {children}
      </Component>
    </>
  )
}

export const Box = React.forwardRef(BoxInner) as <E extends BoxElement = 'div'>(
  props: BoxProps<E> & { ref?: React.ForwardedRef<HTMLElement> },
) => React.ReactElement | null
