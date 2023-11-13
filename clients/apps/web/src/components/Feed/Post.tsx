import {
  BookmarkBorderOutlined,
  ChatBubbleOutline,
  FavoriteBorderOutlined,
  LanguageOutlined,
  MoreVertOutlined,
  PlayArrow,
} from '@mui/icons-material'
import Link from 'next/link'
import { Avatar, Button, PolarTimeAgo } from 'polarkit/components/ui/atoms'
import { twMerge } from 'tailwind-merge'
import SubscriptionGroupIcon from '../Subscriptions/SubscriptionGroupIcon'
import {
  CodePost,
  Post as FeedPost,
  PollPost,
  PostType,
  VideoPost,
} from './data'

export const Post = (props: FeedPost) => {
  return (
    <div className="relative flex w-full flex-row justify-start gap-x-6 py-8">
      <Avatar
        className="h-12 w-12"
        avatar_url={props.author.avatar_url}
        name={props.author.username}
      />
      <div className="flex w-full min-w-0 flex-col">
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
          {props.visibility === 'public' && (
            <>
              <div className="flex flex-row items-center gap-x-1">
                <span className="flex items-center text-blue-500">
                  <LanguageOutlined fontSize="inherit" />
                </span>
                <span className="text-xs">Public</span>
              </div>
              &middot;
            </>
          )}
          <Link href={`/${props.author.username}?tab=subscriptions`}>
            <Button className="px-0" variant="link" size="sm">
              Subscribe
            </Button>
          </Link>
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
    <div className="flex flex-row items-center gap-x-4">
      <div className="dark:text-polar-400 dark:bg-polar-800 dark:border-polar-700 flex flex-row items-center gap-x-8 self-start rounded-full border border-gray-100 bg-white px-4 py-1.5 text-sm text-gray-400 shadow-lg">
        <div className="flex flex-row items-center gap-x-2">
          <FavoriteBorderOutlined fontSize="inherit" />
          <span>{props.likes.length}</span>
        </div>
        <div className="flex flex-row items-center gap-x-2">
          <ChatBubbleOutline fontSize="inherit" />
          <span>{props.likes.length}</span>
        </div>
        <div className="flex flex-row items-center gap-x-2">
          <BookmarkBorderOutlined fontSize="inherit" />
          <span>{props.likes.length}</span>
        </div>
      </div>

      {props.visibility !== 'public' ? (
        <div className="dark:text-polar-400 dark:bg-polar-800 dark:border-polar-700 flex flex-row items-center gap-x-1.5 self-start rounded-full border border-gray-100 bg-white px-3 py-1.5 text-sm text-gray-400 shadow-lg">
          <SubscriptionGroupIcon type={props.visibility} />
          <span className="capitalize">{props.visibility}</span>
        </div>
      ) : null}
    </div>
  )
}

const metaResolver = (post: FeedPost) => {
  switch (post.type) {
    case PostType.Video:
      return <PostMetaVideo {...(post as VideoPost)} />
    case PostType.Code:
      return <PostMetaCode {...(post as CodePost)} />
    case PostType.Poll:
      return <PostMetaPoll {...(post as PollPost)} />
    default:
      return null
  }
}

const PostMeta = (post: FeedPost) => {
  const children = metaResolver(post)

  return children ? (
    <div className="dark:border-polar-700 dark:bg-polar-800 mb-2 flex w-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-sm shadow-xl">
      {children}
    </div>
  ) : null
}

const PostMetaVideo = (post: VideoPost) => {
  return (
    <div className="flex w-full flex-col">
      <div
        className="relative flex h-[260px] w-full flex-col items-center justify-center bg-cover bg-center text-white"
        style={{ backgroundImage: `url(${post.video.thumbnailUrl})` }}
      >
        <span className="z-10 text-5xl">
          <PlayArrow fontSize="inherit" />
        </span>
        <div className="absolute inset-0 bg-[rgba(0_0_0_/_.8)]" />
      </div>

      <div className="flex flex-col gap-y-3 p-4">
        <div className="flex flex-col gap-y-1">
          <h4 className="dark:text-polar-50 font-medium text-gray-950">
            {post.video.title}
          </h4>
          <p className="dark:text-polar-500 truncate text-gray-400">
            {post.video.description}
          </p>
        </div>
      </div>
    </div>
  )
}

const PostMetaCode = (post: CodePost) => {
  return (
    <pre className="max-h-[280px] w-full overflow-auto p-4 text-xs">
      {post.code.code}
    </pre>
  )
}

const PostMetaPoll = (post: PollPost) => {
  const winningOption = post.poll.options.reduce(
    (acc, option, index) => {
      if (option.votes > acc.votes) {
        return { index, votes: option.votes }
      }
      return acc
    },
    {
      index: 0,
      votes: post.poll.options[0].votes,
    },
  )

  return (
    <div className="flex w-full flex-col">
      <div className="dark:border-polar-800 flex flex-col gap-y-1 border-b border-gray-100 px-6 py-4">
        <h4 className="dark:text-polar-50 font-medium">{post.poll.question}</h4>
        <span className="text-xs">{post.poll.totalVotes} votes</span>
      </div>
      <div className="flex flex-col gap-y-2 p-6">
        {post.poll.options.map((option, index) => (
          <div key={option.text} className="relative flex flex-row">
            <div
              className={twMerge(
                'h-8 rounded-md',
                winningOption.index === index
                  ? 'bg-blue-600'
                  : 'dark:bg-polar-600 bg-gray-300',
              )}
              style={{
                width: `${(option.votes / post.poll.totalVotes) * 100}%`,
              }}
            />
            <span
              className={twMerge(
                'absolute inset-x-3 inset-y-2 w-full text-xs',
                winningOption.index === index && 'text-white',
              )}
            >
              {`${Math.round((option.votes / post.poll.totalVotes) * 100)}% ${
                option.text
              }`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
