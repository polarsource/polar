import { Button as ReactEmailButton } from '@react-email/components'

interface ButtonProps {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'green' | 'red'
}

export function Button({ href, children, variant = 'primary' }: ButtonProps) {
  const baseClasses =
    'px-[18px] py-[10px] rounded-lg font-medium text-white no-underline text-center block'

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    red: 'bg-red-600 hover:bg-red-700',
  }

  return (
    <ReactEmailButton
      href={href}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {children}
    </ReactEmailButton>
  )
}

export default Button
