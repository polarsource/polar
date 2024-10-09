import { HTMLMotionProps, motion } from 'framer-motion'
import { PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'

export const ProductWizardPanel = ({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLMotionProps<'div'>>) => {
  return (
    <motion.div
      className={twMerge(
        'dark:bg-polar-950 rounded-4xl dark:border-polar-800 flex flex-col gap-y-8 overflow-y-auto border border-gray-200 bg-white p-16 shadow-sm',
        className,
      )}
      initial="initial"
      animate="animate"
      {...props}
    >
      {children}
    </motion.div>
  )
}
