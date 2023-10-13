import { ChatBubbleLeftIcon } from '@heroicons/react/24/outline'

type Icon = 'thumbs_up' | 'comments'

const IconCounter = (props: { icon: Icon; count: number }) => {
  return (
    <>
      <div className="dark:text-polar-500 inline-flex items-center gap-1 text-[#7E7E7E]">
        {props.icon === 'comments' && (
          <ChatBubbleLeftIcon className="h-4 w-4" />
        )}
        {props.icon === 'thumbs_up' && <span className="text-lg">👍</span>}
        <span className="dark:text-polar-400 text-sm text-gray-500">
          {props.count}
        </span>
      </div>
    </>
  )
}

export default IconCounter
