import { Text as ReactEmailText } from 'react-email'

type TextVariant = 'body' | 'lead' | 'caption' | 'mono'
type TextWeight = 'normal' | 'medium' | 'bold'
type TextAlign = 'left' | 'center'

interface TextProps {
  children: React.ReactNode
  variant?: TextVariant
  weight?: TextWeight
  align?: TextAlign
  as?: 'p' | 'span'
}

const variantClasses: Record<TextVariant, string> = {
  body: 'text-[16px] leading-[24px]',
  lead: 'text-[18px] leading-[28px]',
  caption: 'text-[14px] leading-[20px] text-gray-500',
  mono: 'font-mono text-[14px] leading-[20px]',
}

const weightClasses: Record<TextWeight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  bold: 'font-bold',
}

export function Text({
  children,
  variant = 'body',
  weight = 'normal',
  align = 'left',
  as = 'p',
}: TextProps) {
  if (as === 'span') {
    return <span className={weightClasses[weight]}>{children}</span>
  }

  return (
    <ReactEmailText
      className={`my-[16px] ${variantClasses[variant]} ${weightClasses[weight]} ${
        align === 'center' ? 'text-center' : 'text-left'
      }`}
    >
      {children}
    </ReactEmailText>
  )
}

export default Text
