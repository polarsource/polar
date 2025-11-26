import {
  getAnonymousCustomerColorClasses,
  renderAnonymousCustomerAnimalIcon,
  useAnonymousCustomerName,
} from '@/utils/anonymousCustomer'
import { twMerge } from 'tailwind-merge'

interface AnonymousCustomerAvatarProps {
  externalId: string
  className?: string
}

export const AnonymousCustomerAvatar = ({
  externalId,
  className,
}: AnonymousCustomerAvatarProps) => {
  const [color, animal] = useAnonymousCustomerName(externalId)
  const colorClasses = getAnonymousCustomerColorClasses(color)

  return (
    <div
      className={twMerge(
        'flex items-center justify-center rounded-full ring ring-black/10 ring-inset dark:ring-white/10',
        colorClasses,
        className,
      )}
    >
      {renderAnonymousCustomerAnimalIcon(animal, 'size-[60%]')}
    </div>
  )
}
