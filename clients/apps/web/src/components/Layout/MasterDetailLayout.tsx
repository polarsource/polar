'use client'

import { motion } from 'framer-motion'
import { twMerge } from 'tailwind-merge'

export const MasterDetailLayout = ({
  children,
  wrapperClassName,
  listView,
  listViewClassName,
  placement = 'left',
}: {
  children?: React.ReactNode
  wrapperClassName?: string
  listView?: React.ReactNode
  listViewClassName?: string
  placement?: 'left' | 'right'
}) => {
  return (
    <motion.div
      className={twMerge(
        'flex h-full w-full flex-row gap-x-2',
        placement === 'right' ? 'flex-row-reverse' : '',
      )}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {listView ? (
        <motion.div
          variants={{
            initial: { opacity: 0 },
            animate: { opacity: 1, transition: { duration: 0.3 } },
            exit: { opacity: 0, transition: { duration: 0.3 } },
          }}
          className="dark:bg-polar-900 dark:border-polar-800 h-full w-full overflow-y-hidden rounded-2xl border border-gray-200 bg-white md:max-w-[300px] md:shadow-xs xl:max-w-[320px]"
        >
          {listView}
        </motion.div>
      ) : null}

      <div className="dark:md:bg-polar-900 dark:border-polar-800 relative flex w-full flex-col items-center rounded-2xl border-gray-200 px-4 md:overflow-y-auto md:border md:bg-white md:px-8 md:shadow-xs">
        <motion.div
          className={twMerge(
            'flex h-full w-full max-w-(--breakpoint-xl) flex-col',
            wrapperClassName,
          )}
          variants={{
            initial: { opacity: 0 },
            animate: { opacity: 1, transition: { duration: 0.3 } },
            exit: { opacity: 0, transition: { duration: 0.3 } },
          }}
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  )
}

export const MasterDetailLayoutContent = ({
  header,
  className,
  children,
}: {
  header?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) => {
  return (
    <>
      {header && (
        <div className="flex w-full flex-col gap-y-4 py-8 md:flex-row md:items-center md:justify-between md:py-8">
          {header}
        </div>
      )}

      <div className={twMerge('flex w-full flex-col pb-8', className)}>
        {children}
      </div>
    </>
  )
}
