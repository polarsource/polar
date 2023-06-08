import { MouseEventHandler } from 'react'

const Tab = (props: {
  active: boolean
  children: React.ReactNode
  onClick?: MouseEventHandler
}) => {
  return (
    <div
      onClick={props.onClick}
      className={
        'w-full flex-1 cursor-pointer rounded-md py-1.5 px-3 text-center text-sm transition-all duration-100 ' +
        (props.active
          ? 'bg-white/90 text-gray-900 drop-shadow hover:bg-white hover:text-gray-900 dark:bg-gray-500 dark:text-gray-100 dark:hover:bg-gray-400 dark:hover:text-white'
          : 'bg-transparent text-gray-500 hover:bg-white/50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-gray-200')
      }
    >
      {props.children}
    </div>
  )
}
export default Tab
