import {
  CodePost,
  Post as FeedPost,
  NewsletterPost,
  PollPost,
  PostType,
  VideoPost,
} from '../../data'
import { CodeMeta } from './Code'
import { NewsletterMeta } from './Newsletter'
import { PollMeta } from './Poll'
import { VideoMeta } from './Video'

const metaResolver = (post: FeedPost) => {
  switch (post.type) {
    case PostType.Newsletter:
      return <NewsletterMeta {...(post as NewsletterPost)} />
    case PostType.Video:
      return <VideoMeta {...(post as VideoPost)} />
    case PostType.Code:
      return <CodeMeta {...(post as CodePost)} />
    case PostType.Poll:
      return <PollMeta {...(post as PollPost)} />
    default:
      return null
  }
}

export const PostMeta = (post: FeedPost) => {
  const children = metaResolver(post)

  return children ? (
    <div className="dark:border-polar-700 dark:bg-polar-800 mb-2 flex w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-sm shadow-sm">
      {children}
    </div>
  ) : null
}
