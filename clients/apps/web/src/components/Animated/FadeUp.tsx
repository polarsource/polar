import { HTMLMotionProps, motion } from 'framer-motion'

export type FadeUpProps = HTMLMotionProps<'div'>

const fadeUpVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 1 },
  },
}

export const FadeUp = ({
  variants = fadeUpVariants,
  ...props
}: Omit<HTMLMotionProps<'div'>, 'children' | 'variants'> & FadeUpProps) => {
  return <motion.div variants={variants} {...props} />
}
