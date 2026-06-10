import { schemas } from '@polar-sh/client'
import { Eye, EyeOff } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
interface BenefitVisibilityBadgeProps {
  visibility: schemas['BenefitVisibility']
  className?: string
}

export function BenefitVisibilityBadge({
  visibility,
  className,
}: BenefitVisibilityBadgeProps) {
  const visibilityOption = visibility === 'public' ? 'public' : 'private'
  const Icon = visibilityOption === 'public' ? Eye : EyeOff

  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-center gap-1.5 rounded-[0.5em] px-[0.7em] py-[0.3em] text-sm',
        'bg-gray-100 text-gray-600 dark:bg-polar-700 dark:text-polar-400',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {visibilityOption === 'public'
        ? 'Visible to customers'
        : 'Hidden from customers'}
    </div>
  )
}
