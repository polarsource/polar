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

type MotionElement = 'div' | 'article'

export interface StaggerRevealProps extends HTMLMotionProps<MotionElement> {
  as?: MotionElement
  transition?: Partial<Transition>
}

export const StaggerReveal = ({
  transition,
  as,
  ...props
}: StaggerRevealProps) => {
  const Component = motion[as ?? 'div']
  return (
    <Component
      variants={{
        ...revealVariants,
        visible: {
          ...revealVariants.visible,
          transition: { ...revealVariants.visible.transition, ...transition },
        },
        ...props.variants,
      }}
      initial="hidden"
      animate="visible"
      {...props}
    />
  )
}

StaggerReveal.displayName = 'StaggerReveal'

StaggerReveal.Child = ({ transition, as, ...props }: StaggerRevealProps) => {
  const Component = motion[as ?? 'div']
  return (
    <Component
      variants={{
        ...staggerRevealVariants,
        visible: {
          ...staggerRevealVariants.visible,
          transition: {
            ...staggerRevealVariants.visible.transition,
            ...transition,
          },
          ...props.variants,
        },
      }}
      {...props}
    />
  )
}

/** @ts-ignore */
StaggerReveal.Child.displayName = 'StaggerReveal.Child'
