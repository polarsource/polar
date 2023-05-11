import clsx from 'clsx'

// TODO: Get rid of this and use clsx directly
const classNames = (...classes: string[]) => {
  return clsx(classes)
}

export { clsx, classNames }
