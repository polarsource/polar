import { twMerge } from 'tailwind-merge'

const sizeClasses = {
  small: 'px-[0.4em] py-[0.1em] text-[10px]',
  medium: 'px-[0.7em] py-[0.3em] text-sm',
}

export const Status = ({
  className,
  status,
  size = 'medium',
}: {
  className?: string
  status: string
  size?: 'small' | 'medium'
}) => {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-center rounded-[0.5em]',
        sizeClasses[size],
        className,
      )}
    >
      {status}
    </div>
  )
}
