import { Section } from 'react-email'
import FlatButton from '../Button'

interface ButtonProps {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'green' | 'red'
}

export function Button({ href, children, variant = 'primary' }: ButtonProps) {
  return (
    <Section className="my-[32px] text-center">
      <FlatButton href={href} variant={variant}>
        {children}
      </FlatButton>
    </Section>
  )
}

export default Button
