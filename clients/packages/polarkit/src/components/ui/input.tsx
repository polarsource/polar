import * as React from "react"

import { cn } from "@polarkit/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-background dark:bg-polar-800 dark:border-polar-700 p-3 text-sm ring-offset-background dark:ring-offset-polar-950 file:border-0 file:bg-transparent file:text-sm file:font-medium dark:placeholder:text-polar-400 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 focus-visible:ring-offset-2 dark:focus-visible:ring-polar-600 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
