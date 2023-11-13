import {
  BookmarkBorderOutlined,
  ChatBubbleOutline,
  FavoriteBorderOutlined,
  MoreVertOutlined,
} from '@mui/icons-material'
import Link from 'next/link'
import { Avatar, Button, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import { CodePost, Post as FeedPost, PostType } from './data'

export const Post = (props: FeedPost) => {
  return (
    <div className="relative flex w-full flex-row justify-start gap-x-6 py-8">
      <Avatar
        className="h-12 w-12"
        avatar_url={props.author.avatar_url}
        name={props.author.username}
      />
      <div className="flex min-w-0 flex-col">
        <PostHeader {...props} />
        <PostBody {...props} />
        <PostFooter {...props} />
      </div>
    </div>
  )
}

const PostHeader = (props: FeedPost) => {
  return (
    <div className="flex w-full flex-row items-center justify-between text-sm">
      <div className="flex flex-row items-center gap-x-2">
        <Link href={`/${props.author.username}`}>
          <h3 className="text-blue-500">{props.author.username}</h3>
        </Link>
        <div className="dark:text-polar-400 flex flex-row items-center gap-x-2 text-gray-400">
          &middot;
          <div className="text-xs">
            <PolarTimeAgo date={props.createdAt} />
          </div>
          &middot;
          <Button className="px-0" variant="link" size="sm">
            Subscribe
          </Button>
        </div>
      </div>
      <div className="dark:text-polar-400 text-base">
        <MoreVertOutlined fontSize="inherit" />
      </div>
    </div>
  )
}

const PostBody = (props: FeedPost) => {
  return (
    <div className="dark:text-polar-300 flex w-full flex-col gap-y-4 pb-5 pt-2 text-[15px] leading-relaxed text-gray-800">
      <div className="flex flex-col flex-wrap">{props.text}</div>
      <PostMeta {...props} />
    </div>
  )
}

const PostFooter = (props: FeedPost) => {
  return (
    <div className="dark:text-polar-400 flex flex-row items-center gap-x-12 text-sm text-gray-400">
      <div className="flex flex-row items-center gap-x-2">
        <FavoriteBorderOutlined fontSize="small" />
        <span>{props.likes.length}</span>
      </div>
      <div className="flex flex-row items-center gap-x-2">
        <ChatBubbleOutline fontSize="small" />
        <span>{props.likes.length}</span>
      </div>
      <div className="flex flex-row items-center gap-x-2">
        <BookmarkBorderOutlined fontSize="small" />
        <span>{props.likes.length}</span>
      </div>
    </div>
  )
}

const metaResolver = (post: FeedPost) => {
  switch (post.type) {
    case PostType.Code:
      return <PostMetaCode {...(post as CodePost)} />
    default:
      return null
  }
}

const PostMeta = (post: FeedPost) => {
  const children = metaResolver(post)

  return children ? (
    <div className="dark:border-polar-700 dark:bg-polar-800 mb-2 flex w-full flex-col overflow-auto rounded-lg border border-gray-100 bg-white text-sm">
      {children}
    </div>
  ) : null
}

const PostMetaCode = (post: CodePost) => {
  return (
    <pre className="max-h-[280px] w-full overflow-auto p-4 text-xs">
      {post.code.code}
    </pre>
  )
}
