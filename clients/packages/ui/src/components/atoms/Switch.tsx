'use client'

import * as SwitchPrimitives from '@radix-ui/react-switch'
import * as React from 'react'
import { twMerge } from 'tailwind-merge'

const Switch = ({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) => (
  <SwitchPrimitives.Root
    className={twMerge(
      'focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-polar-700 peer inline-flex h-[18px] w-[37px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=unchecked]:bg-gray-200',
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={twMerge(
        'bg-background dark:data-[state=unchecked]:bg-polar-500 pointer-events-none block h-2 w-2 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-1 dark:data-[state=checked]:bg-white',
      )}
    />
  </SwitchPrimitives.Root>
)
Switch.displayName = SwitchPrimitives.Root.displayName

export default Switch
