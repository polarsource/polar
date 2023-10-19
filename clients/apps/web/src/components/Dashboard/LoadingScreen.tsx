'use client'

import { motion, Transition } from 'framer-motion'

const LogoIcon = ({ animate }: { animate: boolean }) => {
  const transition: Transition = {
    repeat: animate ? Infinity : 0,
    duration: animate ? 0.9 : 0,
    repeatDelay: 0.1,
    ease: 'easeOut',
  }

  const template = ({
    rotate,
    scaleX,
    scaleY,
  }: {
    rotate?: string
    scaleX?: string
    scaleY?: string
  }) => {
    return `rotate(${rotate ? rotate : 0}) scaleX(${
      scaleX ? scaleX : 1
    }) scaleY(${scaleY ? scaleY : 1})`
  }

  return (
    <motion.svg
      width="36"
      height="36"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={'dark:text-polar-950 m-auto text-gray-50'}
      animate={{
        rotate: [0, 90, 180],
      }}
      transition={transition}
    >
      <motion.circle
        cx="20"
        cy="20"
        r="20"
        className="fill-blue-700 dark:fill-blue-600"
      />
      <motion.circle
        animate={{
          scaleX: [0.85, 1, 0.85],
          scaleY: [0.94, 1, 0.94],
          rotate: [27, 0, 27],
        }}
        transition={transition}
        transformTemplate={template}
        cx="20"
        cy="20"
        r="19.5"
        fill="currentColor"
      />
      <motion.circle
        animate={{ scaleX: [0.72, 1, 0.72], rotate: [18, 0, 18] }}
        transition={transition}
        transformTemplate={template}
        cx="20"
        cy="20"
        r="19.5"
        className="fill-blue-700 dark:fill-blue-600"
      />
      <motion.circle
        animate={{
          scaleX: [0.59, 1, 0.59],
          scaleY: [0.925, 1, 0.925],
          rotate: [12, 0, 12],
        }}
        transition={transition}
        transformTemplate={template}
        cx="20"
        cy="20"
        r="19.5"
        fill="currentColor"
      />
      <motion.circle
        animate={{ scaleX: [0.46, 1, 0.46], rotate: [6, 0, 6] }}
        transition={transition}
        transformTemplate={template}
        cx="20"
        cy="20"
        r="19.5"
        className="fill-blue-700 dark:fill-blue-600"
      />
      <motion.circle
        animate={{
          scaleX: [0.33, 1, 0.33],
          scaleY: [0.82, 1, 0.82],
        }}
        transition={transition}
        transformTemplate={template}
        cx="20"
        cy="20"
        r="19.5"
        fill="currentColor"
      />
    </motion.svg>
  )
}

interface Props {
  animate?: boolean
  children: React.ReactNode
}

const LoadingScreen = ({ animate = false, children }: Props) => {
  return (
    <>
      <div className="flex grow items-center justify-center p-8 md:min-h-screen">
        <div className="flex-row">
          <LogoIcon animate={animate} key={`animate-${animate ? 't' : 'f'}`} />
          <div className="dark:text-polar-400 mt-4 text-gray-500">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

export default LoadingScreen

export const LoadingScreenError = (props: { error: string }) => {
  return (
    <div className="space-y-4">
      <div>
        <strong>Oh no!</strong> {props.error}
      </div>
      <div>
        Go back to{' '}
        <a href="/" className="text-blue-500">
          polar.sh
        </a>
      </div>
    </div>
  )
}
