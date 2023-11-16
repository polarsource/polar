import { Avatar } from 'polarkit/components/ui/atoms'
import { NewsletterPost } from '../../data'

export const NewsletterMeta = (post: NewsletterPost) => {
  return (
    <div className="flex w-full flex-col">
      <div className="dark:bg-polar-900 relative flex max-h-[160px] w-full flex-col bg-gray-50 p-6">
        <p className="dark:text-polar-400 text-md line-clamp-4 w-full flex-wrap truncate whitespace-break-spaces break-words italic leading-loose text-gray-500">
          {post.newsletter.description.replace('\n\n', '\n')}
        </p>
      </div>

      <div className="dark:border-polar-700 flex flex-row gap-x-3 border-t border-gray-100 p-4">
        <Avatar
          className="h-10 w-10"
          name={post.author.username}
          avatar_url={post.author.avatar_url}
        />
        <div className="flex flex-col">
          <h4 className="dark:text-polar-50 font-medium text-gray-950">
            {post.author.username}
          </h4>
          <p className="dark:text-polar-400 truncate text-gray-500">
            {post.newsletter.title}
          </p>
        </div>
      </div>
    </div>
  )
}
