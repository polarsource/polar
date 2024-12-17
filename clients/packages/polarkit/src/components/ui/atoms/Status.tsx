import { twMerge } from "tailwind-merge"

export const Status = ({ className, status }: { className: string, status: string }) => {
  return (
    <div className={twMerge("px-2 py-1 text-sm flex flex-row items-center justify-center rounded-md", className)}>
      {status}
    </div>
  )
}
