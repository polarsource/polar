import { Text as ReactEmailText } from 'react-email'

type TextVariant = 'body' | 'lead' | 'caption' | 'footnote' | 'mono' | 'detail'
type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold'
type TextAlign = 'left' | 'center' | 'right'

interface TextProps {
  children: React.ReactNode
  variant?: TextVariant
  weight?: TextWeight
  align?: TextAlign
  as?: 'p' | 'span'
  noMargin?: boolean
}

const variantClasses: Record<TextVariant, string> = {
  body: 'text-[16px] leading-[24px]',
  lead: 'text-[18px] leading-[28px]',
  caption: 'text-[14px] leading-[20px] text-gray-500',
  footnote: 'text-[12px] leading-[16px] text-gray-500',
  mono: 'font-mono text-[14px] leading-[20px]',
  detail: 'text-[14px] leading-[20px] text-gray-900',
}

const weightClasses: Record<TextWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
}

const alignClasses: Record<TextAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

export function Text({
  children,
  variant = 'body',
  weight = 'normal',
  align = 'left',
  as = 'p',
  noMargin = false,
}: TextProps) {
  if (as === 'span') {
    return <span className={weightClasses[weight]}>{children}</span>
  }

  return (
    <ReactEmailText
      className={`${noMargin ? 'm-0' : 'my-[16px]'} ${variantClasses[variant]} ${weightClasses[weight]} ${alignClasses[align]}`}
    >
      {children}
    </ReactEmailText>
  )
}

export default Text
