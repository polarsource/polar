import { motion } from 'framer-motion'
import { Separator } from 'polarkit/components/ui/separator'
import { ComponentProps } from 'react'
import { twMerge } from 'tailwind-merge'

export const AnimatedSeparator = ({
  className,
  orientation = 'horizontal',
  whileInView = true,
  ...props
}: ComponentProps<typeof Separator> & { whileInView?: boolean }) => {
  return (
    <motion.div
      className="min-h-0 min-w-0 flex-shrink-0 origin-center"
      initial="initial"
      variants={{
        initial: {
          opacity: 1,
          width: orientation === 'horizontal' ? 'unset' : '1px',
          height: orientation === 'horizontal' ? '1px' : 'unset',
          scaleX: orientation === 'horizontal' ? '0%' : '100%',
          scaleY: orientation === 'horizontal' ? '100%' : '0%',
        },
        animate: {
          opacity: 1,
          scaleX: '100%',
          scaleY: '100%',
        },
      }}
      transition={{ duration: 1.5, ease: [0.6, 0, 0.4, 1] }}
      {...(whileInView
        ? { viewport: { once: true }, whileInView: 'animate' }
        : { animate: 'animate' })}
    >
      <Separator
        className={twMerge('h-full w-full bg-gray-200', className)}
        orientation={orientation}
        {...props}
      />
    </motion.div>
  )
}
