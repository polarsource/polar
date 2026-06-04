import { Link } from 'react-email'

interface EmailLinkProps {
  href: string
  children: React.ReactNode
}

export function EmailLink({ href, children }: EmailLinkProps) {
  return (
    <Link href={href} className="text-blue-600 underline">
      {children}
    </Link>
  )
}

export default EmailLink
