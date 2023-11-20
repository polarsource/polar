import { HTMLMotionProps, motion, Transition } from 'framer-motion'

const revealVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      staggerChildren: 0.06,
      ease: 'easeInOut',
    },
  },
}

const staggerRevealVariants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
}

export interface StaggerRevealProps extends HTMLMotionProps<'div'> {
  transition?: Partial<Transition>
}

export const StaggerReveal = ({ transition, ...props }: StaggerRevealProps) => {
  return (
    <motion.div
      {...props}
      variants={{
        ...revealVariants,
        visible: {
          ...revealVariants.visible,
          transition: { ...revealVariants.visible.transition, ...transition },
        },
      }}
      initial="hidden"
      animate="visible"
    />
  )
}

StaggerReveal.displayName = 'StaggerReveal'

StaggerReveal.Child = ({ transition, ...props }: StaggerRevealProps) => {
  return (
    <motion.div
      {...props}
      variants={{
        ...staggerRevealVariants,
        visible: {
          ...staggerRevealVariants.visible,
          transition: {
            ...staggerRevealVariants.visible.transition,
            ...transition,
          },
        },
      }}
    />
  )
}

/** @ts-ignore */
StaggerReveal.Child.displayName = 'StaggerReveal.Child'
