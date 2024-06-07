import { ChatBubbleOutline } from '@mui/icons-material'

type Icon = 'thumbs_up' | 'comments'

const IconCounter = (props: { icon: Icon; count: number }) => {
  return (
    <>
      <div className="dark:text-polar-500 inline-flex items-center gap-1 rounded-md text-sm text-gray-400">
        {props.icon === 'comments' && <ChatBubbleOutline fontSize="inherit" />}
        {props.icon === 'thumbs_up' && <span>👍</span>}
        <span className="text-sm">{props.count}</span>
      </div>
    </>
  )
}

export default IconCounter
