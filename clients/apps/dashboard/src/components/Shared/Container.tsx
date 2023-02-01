import { classNames } from 'utils/dom'

const Container = (props) => {
  let maxWidthClass = 'sm:max-w-5xl'
  if (props.wide) {
    maxWidthClass = 'sm:max-w-7xl'
  }

  return (
    <div
      className={classNames(
        'transition-all duration-300 ease-in-out sm:mx-auto sm:w-full flex space-x-6',
        props.className || '',
        maxWidthClass,
      )}
    >
      {props.children}
    </div>
  )
}

export default Container
