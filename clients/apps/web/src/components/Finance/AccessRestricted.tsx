import { ExclamationCircleIcon } from '@heroicons/react/20/solid'
import { ShadowBoxOnMd } from '@polar-sh/ui/components/atoms/ShadowBox'

export interface AccessRestrictedProps {
  message?: string
  variant?: 'card' | 'inline'
}

export default function AccessRestricted({ 
  message = "You are not the admin of the account. Only the account admin can manage payout settings and view account details.",
  variant = 'card'
}: AccessRestrictedProps) {
  const content = (
    <div className="flex items-center gap-4 p-8">
      <ExclamationCircleIcon className="h-8 w-8 text-red-500 flex-shrink-0" />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Access Restricted</h2>
        <p className="dark:text-polar-500 text-gray-500">
          {message}
        </p>
      </div>
    </div>
  )

  if (variant === 'inline') {
    return content
  }

  return (
    <ShadowBoxOnMd>
      {content}
    </ShadowBoxOnMd>
  )
}