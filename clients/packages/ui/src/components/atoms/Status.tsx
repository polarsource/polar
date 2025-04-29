import { twMerge } from 'tailwind-merge'

export const Status = ({
  className,
  status,
}: {
  className?: string
  status: string
}) => {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-center rounded-[0.5em] px-[0.7em] py-[0.3em] text-sm',
        className,
      )}
    >
      {status}
    </div>
  )
}
