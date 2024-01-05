import { Article } from '@polar-sh/sdk'
import { useRouter } from 'next/navigation'
import { Button } from 'polarkit/components/ui/atoms'

const SubscribeNow = (props: { article: Article; isSubscriber: boolean }) => {
  const router = useRouter()

  // User is already subscribed, hide button.
  if (props.isSubscriber) {
    return <></>
  }

  return (
    <div className="flex flex-col items-center py-1">
      <Button
        onClick={() => {
          router.push(`/${props.article.organization.name}/subscriptions`)
        }}
      >
        Subscribe to{' '}
        {props.article.organization.pretty_name ||
          props.article.organization.name}
      </Button>
    </div>
  )
}

export default SubscribeNow
