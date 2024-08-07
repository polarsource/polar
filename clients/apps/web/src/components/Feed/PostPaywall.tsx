import Link from 'next/link'
import Avatar from 'polarkit/components/ui/atoms/avatar'
import Button from 'polarkit/components/ui/atoms/button'
import { RenderArticle } from './Markdown/markdown'

const PostPaywall = (props: {
  isSubscriber: boolean
  article: RenderArticle
}) => {
  const {
    article: { organization },
  } = props
  return (
    <div className="dark:bg-polar-800 rounded-4xl flex flex-col items-center gap-y-6 bg-gray-100 p-8 py-12 md:px-16 ">
      <Avatar
        className="h-12 w-12"
        avatar_url={organization.avatar_url}
        name={organization.name}
      />
      <h2 className="text-center text-xl font-medium">
        This post is for premium subscribers only.
      </h2>
      <p className="dark:text-polar-300 text-center text-gray-500">
        {organization.bio
          ? organization.bio
          : `Support ${
              organization.name
            } by subscribing to their work and get access to exclusive content.`}
      </p>
      <Link href={`/${organization.slug}/subscriptions`}>
        {props.isSubscriber && <Button className="mt-4">Upgrade</Button>}
        {!props.isSubscriber && <Button className="mt-4">Subscribe</Button>}
      </Link>
    </div>
  )
}

export default PostPaywall
