import { Link } from 'react-email'
import { PropsWithChildren } from 'react'

export function EmailLink({
  href,
  children,
}: PropsWithChildren<{ href: string }>) {
  return (
    <Link href={href} className="text-blue-600 underline">
      {children}
    </Link>
  )
}

export default EmailLink
