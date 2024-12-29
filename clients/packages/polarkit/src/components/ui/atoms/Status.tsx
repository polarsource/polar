import { twMerge } from 'tailwind-merge'

export const Status = ({
  className,
  status,
}: {
  className: string
  status: string
}) => {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center justify-center rounded-md px-2 py-1 text-sm',
        className,
      )}
    >
      {status}
    </div>
  )
}
