import { Button as ReactEmailButton } from '@react-email/components'

interface ButtonProps {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'green' | 'red'
}

export function Button({ href, children, variant = 'primary' }: ButtonProps) {
  const variantClasses = {
    primary: 'bg-brand hover:bg-brand',
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
  }

  return (
    <ReactEmailButton
      href={href}
      className={`block rounded-lg px-[18px] py-[10px] text-center text-base font-medium text-white no-underline ${variantClasses[variant]}`}
    >
      {children}
    </ReactEmailButton>
  )
}

export default Button
