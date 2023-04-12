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
        'cursor-pointer rounded-md py-1.5 px-3 text-sm transition-all duration-100 ' +
        (props.active
          ? 'bg-white text-gray-900 drop-shadow '
          : 'bg-transparent text-gray-500 hover:bg-white/50 hover:text-gray-900')
      }
    >
      {props.children}
    </div>
  )
}
export default Tab
