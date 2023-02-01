export const classNames = (...classes) => {
  return classes.filter(Boolean).join(' ')
}
