import { Button as ReactEmailButton, Section } from 'react-email'

interface ButtonProps {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'green' | 'red'
}

export function Button({ href, children, variant = 'primary' }: ButtonProps) {
  const variantClasses = {
    primary: 'bg-black hover:bg-gray-900',
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
  }

  return (
    <Section className="my-[32px] text-center">
      <ReactEmailButton
        href={href}
        className={`block rounded-full px-[18px] py-[10px] text-center text-base font-medium text-white no-underline ${variantClasses[variant]}`}
      >
        {children}
      </ReactEmailButton>
    </Section>
  )
}

export default Button
