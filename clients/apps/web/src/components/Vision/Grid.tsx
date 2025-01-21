import React from 'react'
import { twMerge } from 'tailwind-merge'

type GridProps = {
  items: React.ReactNode[]
  className?: string
}

export const Grid: React.FC<GridProps> = ({ items, className }) => {
  return (
    <div
      className={twMerge(
        'bg-polar-200 border-polar-200 grid gap-[1px] border',
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="bg-polar-900 relative flex aspect-square h-full w-full flex-row items-center p-4"
        >
          {item}
        </div>
      ))}
    </div>
  )
}
