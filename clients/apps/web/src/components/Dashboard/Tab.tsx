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
          ? 'bg-white/90 text-gray-900 drop-shadow hover:bg-white hover:text-gray-900'
          : 'bg-transparent text-gray-500 hover:bg-white/50 hover:text-gray-900')
      }
    >
      {props.children}
    </div>
  )
}
export default Tab
