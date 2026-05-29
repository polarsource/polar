import { Text as ReactEmailText } from 'react-email'
import { PropsWithChildren } from 'react'

export type TextVariant = 'body' | 'lead' | 'caption' | 'mono'
export type TextAlign = 'left' | 'center'
export type TextWeight = 'normal' | 'medium' | 'bold'

const VARIANT_CLASSES: Record<TextVariant, string> = {
  body: 'text-base',
  lead: 'm-0 text-lg text-gray-900',
  caption: 'text-sm text-gray-500',
  mono: 'm-0 font-mono text-sm text-gray-800',
}

const WEIGHT_CLASSES: Record<TextWeight, string> = {
  normal: '',
  medium: 'font-medium',
  bold: 'font-bold',
}

export function Text({
  variant = 'body',
  align = 'left',
  weight = 'normal',
  as = 'p',
  children,
}: PropsWithChildren<{
  variant?: TextVariant
  align?: TextAlign
  weight?: TextWeight
  as?: 'p' | 'span'
}>) {
  const alignClass = align === 'center' ? 'text-center' : ''

  if (as === 'span') {
    const cls = [WEIGHT_CLASSES[weight], alignClass].filter(Boolean).join(' ')
    return <span className={cls || undefined}>{children}</span>
  }

  const cls = [VARIANT_CLASSES[variant], alignClass, WEIGHT_CLASSES[weight]]
    .filter(Boolean)
    .join(' ')
  return <ReactEmailText className={cls}>{children}</ReactEmailText>
}

export default Text
